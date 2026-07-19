---
kind: external_dependency
name: Cloudflare Tunnel for Secure Public Access
slug: cloudflare-tunnel
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### Cloudflare Tunnel Deployment
- **Role:** Provides secure public HTTPS access to internal QFieldCloud and ERP services without exposing ports directly to internet.
- **Integration:** Windows service running cloudflared.exe tunnel run --token YOUR_CLOUDFLARE_TUNNEL_TOKEN with domain sltserp.vynorstore.com.
- **Client Constraint:** Single instance constraint — cannot run both Windows host and Docker container simultaneously with same token due to load-balancer conflicts causing 502 errors.
- **Security:** Eliminates need for firewall port forwarding while maintaining TLS termination at Cloudflare edge.