---
name: supply-chain-hardening
description: Harden SLTSERP dependencies, package manager, CI/CD artifacts, containers, and build supply chain.
metadata:
  short-description: Reduce dependency and build compromise risk
---

# Supply-chain hardening

Use for dependency updates, lockfiles, build scripts, Docker/Coolify images,
CI workflows, generated code, or third-party integrations.

- Use pnpm and the committed lockfile only; do not introduce npm/yarn lockfiles
  or unpinned installation commands.
- Review dependency provenance, advisories, install scripts, license impact,
  and transitive changes. Keep upgrades focused and reproducible.
- Treat CI secrets and build artifacts as sensitive; prevent untrusted PR code
  from accessing production credentials or publishing unsigned artifacts.
- Pin/verify base images and action versions where practical, run least-
  privilege containers, and exclude `.env`, keys, dumps, and test artifacts.
- Run type, unit, security, and build checks after upgrades and record the
  exact lockfile/commit used for deployment.
