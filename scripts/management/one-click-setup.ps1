
$IP = "47.130.203.236"
$USER = "ubuntu"
$KEY = "D:\MyProject\SLTSERP\sltserpkey.pem"

Write-Host "🚀 INITIALIZING FULL MASTER SETUP FOR NEW SERVER: $IP..." -ForegroundColor Cyan

# 1. Prepare Key
Write-Host "--- Preparing SSH key ---" -ForegroundColor Yellow
try {
    icacls "$KEY" /inheritance:r /grant:r "$($env:username):R"
} catch {
    Write-Host "Warning: Could not set ACL, continuing anyway..." -ForegroundColor Gray
}

# Verify connection
Write-Host "--- Testing SSH Connection ---" -ForegroundColor Yellow
ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=20 ${USER}@${IP} "echo 'Connection Successful'"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SSH Connection Failed." -ForegroundColor Red
    exit 1
}

# 2. Upload Files
Write-Host "--- Uploading Scripts & Configs ---" -ForegroundColor Yellow
ssh -i $KEY -o StrictHostKeyChecking=no ${USER}@${IP} "mkdir -p ~/slts-erp/nginx/conf.d"
scp -i $KEY -o StrictHostKeyChecking=no scripts/setup-lightsail-server.sh ${USER}@${IP}:~/setup.sh
scp -i $KEY -o StrictHostKeyChecking=no docker-compose.prod.yml ${USER}@${IP}:~/slts-erp/docker-compose.prod.yml
scp -i $KEY -o StrictHostKeyChecking=no .env ${USER}@${IP}:~/slts-erp/.env
scp -i $KEY -o StrictHostKeyChecking=no -r nginx ${USER}@${IP}:~/slts-erp/

# 3. Execute Setup
Write-Host "--- Running Remote Setup ---" -ForegroundColor Yellow
ssh -i $KEY -o StrictHostKeyChecking=no ${USER}@${IP} "chmod +x ~/setup.sh && ./setup.sh"

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "🎉 ALL SYSTEMS GO! YOUR ERP IS LIVE ON NEW SERVER." -ForegroundColor Green
Write-Host "URL: http://$IP" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
