# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable the repository-pinned pnpm version via corepack
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

# Copy package files, lockfile, .npmrc and prisma schema
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY prisma ./prisma/
# Prisma's postinstall hook runs during dependency installation and needs the
# project-level config to resolve the split schema directory.
COPY prisma.config.ts ./prisma.config.ts
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN pnpm exec prisma generate

# Build Next.js with limited memory
ENV NEXT_TELEMETRY_DISABLED 1
# DOCKER_BUILD=1 → skips tsc/eslint in next.config.ts (prevents OOM on low-RAM VPS)
ENV DOCKER_BUILD 1
RUN NODE_OPTIONS='--max-old-space-size=3072' pnpm run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tzdata

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder /app/node_modules ./node_modules
# The production entrypoint seeds the DB-backed RBAC catalog. Keep the small
# source dependency graph in the runner because the seed runs after migrations
# and before the web process starts.
COPY --from=builder /app/src/config/rbac-permissions.ts ./src/config/rbac-permissions.ts
COPY --from=builder /app/src/config/roles.ts ./src/config/roles.ts
COPY --from=builder /app/src/config/valid-roles.ts ./src/config/valid-roles.ts
COPY --from=builder /app/src/config/project-type-catalog.ts ./src/config/project-type-catalog.ts

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/scripts ./scripts

# Create uploads directory and set permissions
RUN mkdir -p uploads/contractors && chown -R nextjs:nodejs uploads scripts && chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Container liveness must not depend on sync freshness. A delayed external cron tick
# must never make Docker restart a healthy web process; /api/health remains the full
# dependency/sync monitor for operators and uptime alerts.
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
