# Coolify object storage

SLTS Nexus uploads use the S3-compatible `StorageService`. In production it
requires Coolify-hosted MinIO (or another S3-compatible endpoint) and no longer
silently falls back to Supabase or container-local disk.

## Coolify setup

1. Create a MinIO service in Coolify, or deploy
   `deploy/coolify/minio/docker-compose.yml` as a separate Compose resource.
2. Attach a persistent volume to `/data`. A container-only volume is not
   durable across replacement.
3. Use a private bucket named `sltserp-documents` and create a dedicated app
   access key. Do not use the root credentials in the browser.
4. Give MinIO an HTTPS domain such as `storage.example.com` when the app runs
   on Vercel. If the app also runs in Coolify, it may use the private service
   endpoint instead.
5. Configure these server-side environment variables on the app service:

```env
S3_ENDPOINT=https://storage.example.com
S3_BUCKET=sltserp-documents
S3_ACCESS_KEY=sltserp-app
S3_SECRET_KEY=<long-random-secret>
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
STORAGE_REQUIRE_S3=true
STORAGE_ALLOW_LOCAL_FALLBACK=false
```

The bucket should remain private. The application returns authenticated
`/api/storage/...` URLs and streams objects through the server.

## Upload coverage

- `/api/upload` uses the Coolify S3/MinIO bucket.
- GIS uploads are written to `gis-imports/...` before the Redis processing
  session is created; Redis stores the object key instead of the whole base64
  file.
- Contract PDF parsing can read the new authenticated storage URLs.
- Local disk is available only when `STORAGE_ALLOW_LOCAL_FALLBACK=true` in a
  development environment.

After setting the variables, upload a small test file, confirm its object key
under the bucket, restart/redeploy the app, and download it again. Never test
with production documents until the download and backup checks pass.
