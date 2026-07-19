---
kind: external_dependency
name: Supabase Managed PostgreSQL with Read Replica
slug: supabase
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### Supabase Managed PostgreSQL
- **Role:** Primary write database and read replica for analytical queries, replacing self-hosted Postgres in production.
- **Integration:** Prisma client dual-instance pattern — primaryClient writes to DATABASE_URL, readClient routes read operations to READ_REPLICA_URL via $extends query interceptor.
- **Constraint:** Production uses Supabase Pro tier; local dev falls back to Docker Compose PostGIS container. Read replica must be configured separately from primary URL to enable routing.
- **Verify exact API/params against official docs