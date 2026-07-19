---
kind: external_dependency
name: DigitalOcean Droplet Hosting
slug: digitalocean
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### DigitalOcean Droplet
- **Role:** Production application host running Next.js standalone output, Redis, and Nginx reverse proxy.
- **Integration:** GitHub Actions SCPs build artifacts to server IP via SSH private key, then runs docker compose -f docker-compose.prod.yml up -d --build on the droplet.
- **Constraint:** Minimum 4GB RAM / 2 vCPUs recommended; CPU burst-credit instances (AWS Lightsail) explicitly avoided due to sustained workload requirements.
- **Verify exact API/params against official docs