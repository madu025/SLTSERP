$IP = "47.131.28.225"
$USER = "ubuntu"
$KEY = "LightsailDefaultKey-ap-southeast-1.pem"

Write-Host "🔍 Debugging Server at $IP..." -ForegroundColor Cyan

# SSH command to run everything in one go to reduce connections
$script = @"
echo '--- Docker PS ---'
sudo docker ps
echo '--- UFW Status ---'
sudo ufw status
echo '--- App Logs ---'
cd ~/slts-erp && sudo docker compose -f docker-compose.prod.yml logs --tail 20
"@

ssh -i $KEY -o StrictHostKeyChecking=no ${USER}@${IP} $script
