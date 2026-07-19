---
kind: build_system
name: Next.js Standalone + Docker Compose Build & Deploy Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - next.config.ts
    - Dockerfile
    - Dockerfile.prod
    - docker-compose.yml
    - docker-compose.prod.yml
    - docker-entrypoint.sh
    - .github/workflows/deploy.yml
    - smart-deploy.ps1
---

The repository uses a Next.js 16 application built with the standalone output mode, packaged into multi-stage Docker images and deployed via GitHub Actions to a remote server running Docker Compose. The pipeline supports both local development (docker-compose.yml) and production (docker-compose.prod.yml) stacks that include PostgreSQL/PostGIS, Redis (BullMQ), GeoServer, Nginx reverse proxy, and the Next.js app.

### Build System Components

- **Build toolchain**: npm ci -> npx prisma generate -> next build (standalone). Prisma client generation runs as part of the build and again in postinstall.
- **Dockerfiles**: Two variants - Dockerfile (development-friendly, builds inside image) and Dockerfile.prod (consumes a pre-built standalone bundle copied from CI or local smart-deploy.ps1). Both use node:22-alpine, create a non-root nextjs user, and run via docker-entrypoint.sh.
- **Entrypoint**: docker-entrypoint.sh executes prisma migrate deploy before starting node server.js, ensuring schema migrations are applied on every container start.
- **Next.js config**: output: standalone, reactStrictMode: true, compress: true, productionBrowserSourceMaps: false, and selective optimizePackageImports for lucide-react/date-fns/recharts.

### Container Stack (docker-compose.prod.yml)

| Service | Image / Build | Purpose |
|---|---|---|
| postgres | postgis/postgis:16-3.4-alpine | Postgres + PostGIS data store; health-checked; initialized from postgres-init/ |
| geoserver | ./docker/geoserver/Dockerfile | WMS/WFS GIS services backed by PostGIS |
| app | Dockerfile.prod | Next.js standalone server on port 3000 |
| redis | redis:7-alpine | BullMQ job queue backing |
| nginx | ./nginx/Dockerfile.nginx | Reverse proxy exposing port 80 |

Volumes persist postgres_data, redis_data, and uploads_data; all services share the sltserp-network bridge network.

### CI/CD Pipeline (.github/workflows/deploy.yml)

Triggered on push to main:
1. Checks out code, sets up Node 22 with npm cache.
2. Installs deps (npm ci) and builds (npm run build).
3. Stages a deployment bundle containing .next/standalone, .next/static, public/, prisma/, Dockerfile.prod, docker-compose.prod.yml, docker-entrypoint.sh, .env, and nginx/.
4. Zips the bundle to deploy.zip.
5. SCPs the zip to the remote server (${{ secrets.SERVER_IP }}) and SSHs in to unzip, tear down old containers, and docker compose -f docker-compose.prod.yml up -d --build.

### Local Development vs Production

- **Local dev**: docker-compose.yml starts only redis, app, and optional pgadmin (no embedded Postgres to avoid conflicts with a remote DB).
- **Production**: docker-compose.prod.yml includes the full stack (postgres, geoserver, redis, app, nginx).
- **Smart deploy script** (smart-deploy.ps1) provides a Windows-side shortcut: cleans .next, runs npm run build, stages the same bundle structure as CI, zips it, SCPs to the server, and triggers the same remote compose command.

### Database Migrations

Prisma manages schema evolution through files under prisma/migrations/. Migrations are applied automatically at container startup via prisma migrate deploy in the entrypoint. Seed scripts live under prisma/seed* and are configured in package.json (prisma.seed = "node prisma/seed.js").

### Key Conventions for Developers

- Always run npm run build locally before pushing if you change dependencies or Prisma schema - the CI build is the source of truth for the production artifact.
- Do not commit node_modules, .next, or deploy.zip; they are generated artifacts.
- Environment variables must be supplied via .env (copied into the bundle by CI/script) or via the host's environment when running docker compose directly.
- New services should be added to docker-compose.prod.yml and referenced by the sltserp-network bridge.
- Keep Dockerfile.prod minimal - it expects a pre-bundled standalone output; do not add build steps there.