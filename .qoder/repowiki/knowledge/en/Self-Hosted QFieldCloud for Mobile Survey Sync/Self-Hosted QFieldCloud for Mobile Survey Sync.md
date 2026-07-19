---
kind: external_dependency
name: Self-Hosted QFieldCloud for Mobile Survey Sync
slug: qfieldcloud
category: external_dependency
category_hints:
    - vendor_identity
    - sdk_real_api
scope:
    - '**'
---

### QFieldCloud Self-Hosted Stack
- **Role:** Manages QGIS project lifecycle, delta synchronization between field devices and SLTSERP database, and mobile survey data collection.
- **Integration:** REST API at /api/v1/projects/, /api/v1/auth/login/, and delta endpoints; authenticated via token-based login with admin credentials from environment variables.
- **SDK Pattern:** Token auto-refresh on 401 responses; project naming convention {projectCode}_{name} sanitized to alphanumeric.
- **Deployment:** Separate docker-compose stack on port 8100 with dedicated PostGIS DB, MinIO storage, and Cloudflare Tunnel for public access.
- **Verify exact API/params against official docs