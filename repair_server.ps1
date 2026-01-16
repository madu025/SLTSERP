ssh -i "C:\Users\Prasad\Downloads\LightsailDefaultKey-ap-southeast-1.pem" -o StrictHostKeyChecking=no ubuntu@54.255.90.86 "cat <<'REPAIR' > ~/repair.py
import os
env_content = [
    'DATABASE_URL=\"postgresql://postgres.prbyiuyzcsfyduajmajx:%40Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1\"',
    'READ_REPLICA_URL=\"postgresql://postgres.xhhbwywbnktwkbjijzxi:%40Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true\"',
    'DIRECT_URL=\"postgresql://postgres.prbyiuyzcsfyduajmajx:%40Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres\"',
    'JWT_SECRET=\"slts-erp-secret-2026\"',
    'NEXTAUTH_SECRET=\"slts-erp-secret-2026\"',
    'NEXTAUTH_URL=\"https://d2ppcululqu48p.cloudfront.net\"',
    'NEXT_PUBLIC_APP_URL=\"https://d2ppcululqu48p.cloudfront.net\"',
    'NODE_ENV=\"production\"',
    'PORT=3000',
    'CRON_SECRET=\"slts-erp-secret-2026\"'
]
with open('/home/ubuntu/slts-erp/.env', 'w') as f:
    f.write('\\n'.join(env_content) + '\\n')
REPAIR
python3 ~/repair.py && cd ~/slts-erp && docker compose up -d --build"
