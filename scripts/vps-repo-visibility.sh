#!/usr/bin/env bash
# Decisive: is github.com/madu025/SLTSERP readable without credentials, and are the
# confidential business documents in the tracked tree reachable by anyone?
set -uo pipefail
code=$(curl -s -o /root/.r.json -w '%{http_code}' -H 'Accept: application/vnd.github+json' 'https://api.github.com/repos/madu025/SLTSERP')
echo "repo metadata -> HTTP $code"
python3 - <<'PY'
import json
try:
    d = json.load(open('/root/.r.json'))
except Exception as e:
    print('  parse error', e); raise SystemExit
for k in ('full_name', 'private', 'visibility', 'fork', 'default_branch', 'size', 'created_at', 'pushed_at', 'html_url'):
    print('  %-14s %s' % (k, d.get(k, d.get('message'))))
PY
echo "--- unauthenticated fetch of tracked paths (200 = world readable) ---"
for p in "Agreement/Principal%20Contract%20of%20SLTS%20for%20FTTH%20NC%202024.pdf" \
         "Contractor_invoice/CENTRAL.xlsx" \
         "OSP-Account/Audit%20Query%20on%20Threewheel%20staff.docx" \
         ".env" ".ssh-vps/sltserp-vps" "src/app/api/health/route.ts"; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "https://api.github.com/repos/madu025/SLTSERP/contents/$p?ref=main")
  echo "  HTTP $c  $p"
done
rm -f /root/.r.json
