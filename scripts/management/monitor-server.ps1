
$IP = "47.131.28.225"
$USER = "ubuntu"
$KEY_ORIGINAL = "D:\MyProject\SLTSERP\LightsailDefaultKey-ap-southeast-1.pem"
$KEY_TEMP = "D:\MyProject\SLTSERP\monitor_key.pem"

# Prepare key
Get-Content $KEY_ORIGINAL | Set-Content $KEY_TEMP
icacls "$KEY_TEMP" /reset
icacls "$KEY_TEMP" /inheritance:r
icacls "$KEY_TEMP" /grant:r "$($env:username):R"

Write-Host "Starting Docker containers..." -ForegroundColor Cyan
ssh -i "$KEY_TEMP" -o StrictHostKeyChecking=no ${USER}@${IP} "cd ~/slts-erp && sudo docker compose -f docker-compose.prod.yml up -d && sudo docker ps"

# Cleanup
icacls "$KEY_TEMP" /grant:r "$($env:username):F"
Remove-Item $KEY_TEMP
