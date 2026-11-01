---
name: configuration-secrets
description: Manage SLTSERP environment configuration, secrets, feature flags, and runtime settings safely across local, CI, and production.
metadata:
  short-description: Keep configuration explicit and secrets protected
---

# Configuration and secrets

Use for environment variables, runtime settings, feature flags, integrations,
Coolify/Vercel configuration, credentials, or secret rotation.

- Validate required configuration at startup with safe diagnostics; never log
  values, tokens, connection strings, or full URLs containing credentials.
- Keep secrets in the platform secret manager/CI secret store. Do not commit
  `.env` files, passwords, JWTs, S3 keys, or database URLs.
- Separate development, staging, and production targets; fail closed when a
  production safety setting is absent (for example private storage/no fallback).
- Treat feature flags and config as security-sensitive: scope, audit, expire,
  and test both enabled and disabled paths.
- Rotate credentials without downtime where possible and verify old secrets no
  longer authenticate after rotation.
