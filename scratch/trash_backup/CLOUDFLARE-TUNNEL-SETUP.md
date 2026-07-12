# ☁️ Cloudflare Tunnel Docker Setup & Troubleshooting Guide for SLTSERP & QFieldCloud

This guide explains how to configure, run, and troubleshoot the Cloudflare Tunnel for `https://sltserp.vynorstore.com` using Docker. It is designed to be easily read and executed by both human developers and AI agents.

---

## 1. Context & Architecture

- **QFieldCloud Stack**: Located at `D:\QFieldCloud`, running via Docker Compose.
- **Reverse Proxy**: `qfieldcloud-nginx-1` listens on port `80` (HTTP) and `443` (HTTPS) on the host machine.
- **Backend Application**: `qfieldcloud-app-1` (Django application listening on port `8000` inside the `qfieldcloud_default` network).
- **Public Domain**: `https://sltserp.vynorstore.com` routes external traffic to QFieldCloud via Cloudflare Tunnel.

---

## 2. Prerequisites

Before starting, ensure you have:
1. **Cloudflare Account**: Access to the Cloudflare Zero Trust dashboard.
2. **Domain**: `vynorstore.com` must be managed under your Cloudflare account.
3. **A Created Tunnel**: A tunnel named `sltserp-tunnel` created in the Cloudflare Zero Trust Dashboard (**Access -> Tunnels**), which provides a unique **Tunnel Token**.

---

## 3. Running the Cloudflare Tunnel

### Option A: Running as a Windows Process (Currently Active Setup)
Run the following command on the host Windows machine:
```powershell
"D:\MyProject\SLTSERP\cloudflared.exe" tunnel run --token YOUR_CLOUDFLARE_TUNNEL_TOKEN
```

### Option B: Integrated Setup (Docker Compose)
Add the `tunnel` service directly to your `docker-compose.yml` file under `services`. It must share the same network to route traffic to Nginx.

```yaml
  # Cloudflare Tunnel Service
  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: sltserp-tunnel
    restart: unless-stopped
    environment:
      - TUNNEL_TOKEN=your_actual_cloudflare_tunnel_token_here
    command: tunnel --no-autoupdate run
    networks:
      - qfieldcloud_default
    depends_on:
      - nginx
```

---

## 4. Crucial Troubleshooting & Critical Configurations

If you are setting up or testing this stack from the beginning, be aware of these four critical areas:

### ⚠️ Critical 1: Duplicate Tunnel Connectors (Causes 502 Bad Gateway)
**NEVER** run more than one instance of the tunnel connector with the same token simultaneously unless they are configured identical. 
- If you start the tunnel inside a Docker container (e.g. `temp-sltserp-tunnel`) while the Windows host `cloudflared.exe` process is also running, Cloudflare will load-balance traffic between them.
- Since the container tunnel is usually not connected to the host's port or network, requests routed to the container will fail with a **502 Bad Gateway** error on mobile clients.
- **Action**: Stop and remove any duplicate docker tunnel containers if you are using the Windows host service:
  ```bash
  docker stop temp-sltserp-tunnel
  ```

### 🔒 Critical 2: Django CSRF Security (Required for Login & POST Requests)
When requests come through the Cloudflare Tunnel via HTTPS, Django's CSRF middleware checks the `Origin` header (`https://sltserp.vynorstore.com`). If not explicitly allowed, Django returns a **403 Forbidden** (which shows as a network error on QField App).
- **Solution**: The `D:\QFieldCloud\docker-app\qfieldcloud\settings.py` file must contain a dynamic `CSRF_TRUSTED_ORIGINS` block:
  ```python
  CSRF_TRUSTED_ORIGINS = parse_string_to_list(
      os.environ.get("CSRF_TRUSTED_ORIGINS", ""), delimiter=","
  )
  if not CSRF_TRUSTED_ORIGINS:
      CSRF_TRUSTED_ORIGINS = [
          f"https://{host}"
          for host in ALLOWED_HOSTS
          if host not in ("localhost", "127.0.0.1", "0.0.0.0", "app", "nginx", "[::1]")
      ]
      CSRF_TRUSTED_ORIGINS += [
          "http://localhost:8011",
          "http://localhost:8000",
          "http://127.0.0.1:8011",
          "http://127.0.0.1:8000",
      ]
  ```

### 🔄 Critical 3: Nginx DNS Startup Delay (`app could not be resolved`)
- **Behavior**: When running `docker compose up -d`, the Nginx container may start up faster than the Django `app` container. This causes a temporary Nginx error: `app could not be resolved (3: Host not found)`.
- **Handling**: This is normal. Nginx is configured with the `resolve` flag in `upstream django` inside `default.conf.template` along with `resolver 127.0.0.11 valid=1s ipv6=off;`. As soon as the `app` container finishes launching, Nginx will resolve its IP address dynamically and route traffic successfully.

### 🔑 Critical 4: Django Axes Account Lockout & Admin Password Reset
If a user is locked out due to multiple failed login attempts, you can reset the lockout status and change passwords directly inside the `qfieldcloud-app-1` container.
- **Clear Lockouts**:
  ```bash
  docker exec qfieldcloud-app-1 python3 manage.py axes_reset
  ```
- **Reset Admin Password**:
  ```bash
  docker exec qfieldcloud-app-1 python3 manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); u = User.objects.get(username='admin'); u.set_password('admin123'); u.save(); print('Password updated')"
  ```

---

## 5. Verification Commands for AI Agents

To test and verify the setup end-to-end, execute the following commands in sequence:

1. **Verify all QFieldCloud Docker containers are running**:
   ```bash
   cd D:\QFieldCloud
   docker compose ps
   ```
2. **Test Endpoint connectivity locally inside the Nginx container**:
   ```bash
   docker exec qfieldcloud-nginx-1 curl -I http://app:8000/
   ```
   *(Should return HTTP 302/200)*
3. **Verify Public HTTPS Routing and CSRF support**:
   ```bash
   curl.exe -k -i -X POST -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}" https://sltserp.vynorstore.com/api/v1/auth/token/
   ```
   *(Should return HTTP 200 OK along with a login token string)*
