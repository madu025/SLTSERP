# 🐳 PostgreSQL Docker Setup Guide

## Prerequisites
- Docker Desktop installed
- Docker Compose installed
- At least 4GB RAM available
- 20GB disk space

## Quick Start

### 1. Start PostgreSQL Container
```bash
# Start in detached mode
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f postgres
```

### 2. Update .env File
Update your `.env` file with the new database connection:

```env
# Local Docker PostgreSQL
DATABASE_URL="postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db"

# Keep Supabase as Read Replica (optional)
READ_REPLICA_URL="postgresql://postgres.xhhbwywbnktwkbjijzxi:%40Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### 3. Initialize Database Schema
```bash
# Push Prisma schema to Docker PostgreSQL
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 4. Migrate Data from Supabase (Optional)
```bash
# Export from Supabase
pg_dump "postgresql://postgres.prbyiuyzcsfyduajmajx:@Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" > backup.sql

# Import to Docker
docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < backup.sql
```

## Access PgAdmin
- URL: http://localhost:5050
- Email: admin@sltserp.local
- Password: admin123

### Add Server in PgAdmin:
- Host: postgres (container name)
- Port: 5432
- Database: sltserp_db
- Username: sltserp_user
- Password: YourSecurePassword123!

## Useful Commands

### Container Management
```bash
# Stop containers
docker-compose stop

# Start containers
docker-compose start

# Restart containers
docker-compose restart

# Stop and remove containers
docker-compose down

# Stop and remove with volumes (⚠️ DELETES DATA)
docker-compose down -v
```

### Database Backup
```bash
# Create backup
docker exec sltserp-postgres pg_dump -U sltserp_user sltserp_db > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < backup_20260121.sql
```

### Database Access
```bash
# Connect to PostgreSQL CLI
docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db

# Run SQL file
docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < script.sql
```

### Monitoring
```bash
# View container stats
docker stats sltserp-postgres

# View logs
docker logs -f sltserp-postgres

# Check health
docker inspect sltserp-postgres | grep -A 10 Health
```

## Performance Tuning

### For Production Server (4GB+ RAM):
Edit `postgres-init/01-init.sh` and adjust:
```sql
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
```

### For Development (2GB RAM):
```sql
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET maintenance_work_mem = '32MB';
```

## Security Best Practices

1. **Change Default Passwords**: Update `.env.docker` with strong passwords
2. **Firewall Rules**: Only expose port 5432 to your application server
3. **SSL/TLS**: Enable SSL in production
4. **Regular Backups**: Set up automated daily backups
5. **Update Images**: Regularly update PostgreSQL image

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs postgres

# Remove and recreate
docker-compose down -v
docker-compose up -d
```

### Connection refused
```bash
# Check if container is running
docker ps | grep postgres

# Check port binding
netstat -an | findstr 5432

# Test connection
docker exec sltserp-postgres pg_isready -U sltserp_user
```

### Slow queries
```bash
# Enable query logging
docker exec sltserp-postgres psql -U sltserp_user -d sltserp_db -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"
docker-compose restart postgres
```

## Migration from Supabase

### Full Migration Steps:
1. Backup Supabase data
2. Start Docker PostgreSQL
3. Push Prisma schema
4. Import data
5. Update application .env
6. Test thoroughly
7. Update production deployment

### Hybrid Approach (Recommended):
- **Primary**: Docker PostgreSQL (writes)
- **Replica**: Supabase (reads)
- **Benefit**: Cost savings + redundancy

## Cost Comparison

### Supabase (Current):
- Database: $25/month
- Egress: Variable
- **Total**: ~$30-50/month

### Docker Self-Hosted:
- Server: $10-20/month (VPS)
- Backup Storage: $5/month
- **Total**: ~$15-25/month
- **Savings**: 40-50%

## Next Steps

1. ✅ Set up Docker PostgreSQL locally
2. ✅ Test with development data
3. ✅ Configure backups
4. ✅ Deploy to production server
5. ✅ Monitor performance
6. ✅ Optimize as needed
