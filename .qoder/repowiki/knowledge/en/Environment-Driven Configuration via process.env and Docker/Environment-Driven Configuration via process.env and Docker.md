---
kind: configuration_system
name: Environment-Driven Configuration via process.env and Docker
category: configuration_system
scope:
    - '**'
source_files:
    - next.config.ts
    - package.json
    - prisma/schema.prisma
    - src/lib/prisma.ts
    - docker-compose.yml
    - Dockerfile
    - .github/workflows/deploy.yml
    - src/data/slt-config.json
---

The SLT ERP monorepo uses a straightforward, environment-variable-driven configuration system with no centralized config loader. All runtime settings are consumed directly from process.env throughout the codebase, injected at build or container runtime time.

How configuration is loaded:
- Next.js app reads env vars inline in route handlers and services (e.g., GEOSERVER_URL, GEMINI_API_KEY, NEXT_PUBLIC_APP_URL, CRON_SECRET). There is no shared config module — each file imports what it needs from process.env.
- Prisma schema (prisma/schema.prisma) reads its database URL via env("DATABASE_URL") / env("DIRECT_URL"); a custom singleton wrapper in src/lib/prisma.ts further augments connection URLs with timeouts and read-replica routing logic.
- Playwright test runner reads CI to toggle retries and server reuse.
- A small JSON file src/data/slt-config.json holds a single PHP session cookie for an external registry sync; it is read via path.join(process.cwd(), 'src/data/slt-config.json') in one API route.

Where values come from:
- Local development: .env file (gitignored) containing DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXT_PUBLIC_APP_URL, etc.
- CI/CD: GitHub Actions workflow (deploy.yml) constructs a .env at build time from repository secrets (secrets.DATABASE_URL, secrets.NEXTAUTH_SECRET, secrets.NEXT_PUBLIC_APP_URL, ...).
- Container runtime: docker-compose.yml injects DATABASE_URL, DIRECT_URL, REDIS_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET, TZ into the app service; Dockerfile sets NODE_ENV=production, PORT=3000, HOSTNAME=0.0.0.0, and NEXT_TELEMETRY_DISABLED=1.
- External services: QFieldCloud credentials (QFIELD_ADMIN_USER, QFIELD_ADMIN_PASS, NEXT_PUBLIC_QFIELD_API_URL), GeoServer credentials (GEOSERVER_URL, GEOSERVER_USER, GEOSERVER_PASS, GEOSERVER_WORKSPACE), Gemini AI key (GEMINI_API_KEY, GEMINI_MODEL), and cron job auth (CRON_SECRET) are all expected as env vars.

Architecture and conventions:
- No typed config object or validation layer exists; every consumer reads raw strings from process.env and applies defaults inline (e.g., process.env.GEOSERVER_URL || 'http://geoserver:8080/geoserver').
- Secrets and non-secret settings are mixed together — there is no separation between public (NEXT_PUBLIC_*) and secret variables beyond naming convention.
- The only structured, versioned configuration is the Prisma schema itself; everything else is ad-hoc per-file.
- Deployment artifacts copy .env into the deploy directory so the running image can pick it up.

Rules developers should follow:
- Define new settings as process.env.XXX with sensible fallbacks at the point of use; do not create a central config module unless you introduce validation.
- Use NEXT_PUBLIC_ prefix for any variable that must be available in the browser bundle.
- Keep secrets out of source control — rely on GitHub Secrets + deploy.yml for CI builds and compose/environment injection for containers.
- When adding a new external service dependency, document the required env var names alongside the code that consumes them.