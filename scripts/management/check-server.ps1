$IP = "47.131.28.225"
$USER = "ubuntu"
$KEY = "LightsailDefaultKey-ap-southeast-1.pem"

# Ensure key permissions
icacls $KEY /inheritance:r
icacls $KEY /grant:r "${env:USERNAME}:(R)"

# Run Docker PS
ssh -i $KEY -o StrictHostKeyChecking=no ${USER}@${IP} "sudo docker ps"
