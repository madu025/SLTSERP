---
name: storage-gis-qfield
description: Secure SLTSERP S3/MinIO storage, GIS imports, QField sync, geospatial validation, and authenticated file access.
metadata:
  short-description: Protect uploads and GIS processing
---

# Storage, GIS, and QField

Use for uploads, documents, GIS routes/imports, GeoJSON/GeoPackage parsing,
QField configuration/sync, or object-storage changes.

- Keep production storage private and server-mediated. Do not expose S3 keys,
  root credentials, bucket internals, or unauthenticated object URLs.
- Validate filename, MIME type, size, archive contents, geometry, coordinate
  reference, and project/source compatibility before processing.
- Preserve authenticated download authorization and project/OPMC scope for
  every object. Local-disk fallback is development-only when explicitly
  configured.
- Treat Redis/object-storage processing as asynchronous: persist an object key,
  processing status, checksum, and failure reason; never claim import success
  before read-back verification.
- Keep GIS-only/QField modules hidden or read-only when the project planning
  source does not support them.

Use `docs/coolify-storage.md` and the GIS services as the source of truth. Test
small non-sensitive fixtures, external-storage failure behavior, and download
read-back before production claims.
