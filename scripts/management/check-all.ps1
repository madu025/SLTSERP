
$IP = "47.131.28.225"
$USER = "ubuntu"
$KEY_ORIGINAL = "D:\MyProject\SLTSERP\LightsailDefaultKey-ap-southeast-1.pem"
$KEY_TEMP = "D:\MyProject\SLTSERP\debug_key_2.pem"

Get-Content $KEY_ORIGINAL | Set-Content $KEY_TEMP
icacls "$KEY_TEMP" /reset
icacls "$KEY_TEMP" /inheritance:r
icacls "$KEY_TEMP" /grant:r "$($env:username):R"

ssh -i "$KEY_TEMP" -o StrictHostKeyChecking=no ${USER}@${IP} "sudo docker ps -a"

# Remove key (using force/reset if needed)
icacls "$KEY_TEMP" /grant:r "$($env:username):F"
Remove-Item $KEY_TEMP
