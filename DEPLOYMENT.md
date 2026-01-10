# Vercel + Supabase Deployment Guide

## 📋 Environment Variables Setup

### Required Environment Variables for Vercel:

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key-here-change-this-in-production"
NEXTAUTH_URL="https://your-app-name.vercel.app"

# Optional: File Upload
# CLOUDINARY_CLOUD_NAME=""
# CLOUDINARY_API_KEY=""
# CLOUDINARY_API_SECRET=""
```

## 🚀 Deployment Steps

### 1. Supabase Setup
- Create account at supabase.com
- Create new project
- Get connection strings from Settings → Database
- Save your database password!

### 2. Vercel Setup
- Create account at vercel.com
- Import GitHub repository
- Add environment variables
- Deploy!

### 3. Run Migrations
```bash
# After first deployment
vercel env pull .env.local
npx prisma migrate deploy
npx prisma generate
```

## 📝 Notes
- Update NEXTAUTH_URL after getting your Vercel domain
- For file uploads, consider using Vercel Blob or Cloudinary
- Free tier limits: Check Supabase and Vercel documentation
