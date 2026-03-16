
# ==========================================================================
# SLTSERP - Smart Deploy (V2)
# ==========================================================================

$IP = "47.130.203.236"
$USER = "ubuntu"
$KEY = "D:\MyProject\SLTSERP\sltserpkey.pem"
$PROJECT_ROOT = "D:\MyProject\SLTSERP"

Write-Host "🚀 STARTING SMART DEPLOY (LOCAL BUILD + REMOTE RUN)..." -ForegroundColor Cyan

# 1. Local Build
Write-Host "--- Step 1: Running Local Build (Fast) ---" -ForegroundColor Yellow
Set-Location $PROJECT_ROOT

# Clean old build
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
if (Test-Path "deploy.zip") { Remove-Item "deploy.zip" }

# Run build
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Local Build Failed." -ForegroundColor Red
    exit 1
}

# 2. Prepare Deployment Bundle
Write-Host "--- Step 2: Preparing Deployment Bundle ---" -ForegroundColor Yellow
if (-not (Test-Path ".next/standalone")) {
    Write-Host "❌ Standalone build not found." -ForegroundColor Red
    exit 1
}

# Create temp staging folder
$staging = "deploy_staging"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging

# Copy necessary files to staging
Copy-Item -Recurse -Force ".next/standalone/*" $staging
Copy-Item -Recurse -Force "public" "$staging/"
Copy-Item -Recurse -Force ".next/static" "$staging/.next/"
Copy-Item -Recurse -Force "prisma" "$staging/"
Copy-Item -Force "docker-entrypoint.sh" "$staging/"
Copy-Item -Force "Dockerfile.prod" "$staging/"

# Zip it
Compress-Archive -Path "$staging/*" -DestinationPath "deploy.zip"
Remove-Item -Recurse -Force $staging

# 3. Upload and Deploy
Write-Host "--- Step 3: Uploading Bundle ---" -ForegroundColor Yellow
icacls "$KEY" /inheritance:r /grant:r "$($env:username):R"

scp -i "$KEY" -o StrictHostKeyChecking=no "deploy.zip" ${USER}@${IP}:~/slts-erp/deploy.zip
scp -i "$KEY" -o StrictHostKeyChecking=no "docker-compose.prod.yml" ${USER}@${IP}:~/slts-erp/docker-compose.prod.yml
scp -i "$KEY" -o StrictHostKeyChecking=no ".env" ${USER}@${IP}:~/slts-erp/.env

Write-Host "--- Step 4: Extracting and Starting on Server ---" -ForegroundColor Yellow
$remoteCmd = @"
cd ~/slts-erp
sudo apt-get install -y unzip
unzip -o deploy.zip -d .
sudo docker compose -f docker-compose.prod.yml up -d --build
"@

ssh -i "$KEY" -o StrictHostKeyChecking=no ${USER}@${IP} $remoteCmd

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "🎉 SMART DEPLOY COMPLETE! YOUR ERP IS LIVE." -ForegroundColor Green
Write-Host "URL: http://$IP" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
