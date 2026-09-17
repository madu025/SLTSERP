# SLTSERP Agent - Build & Sign Script
# Rebuilds and code-signs the SLTSERPagent.exe to minimize Smart App Control blocks

$ErrorActionPreference = "Stop"

# Auto-detect project directory
$DefaultAgentDir = "C:\Users\Prasad\Desktop\SLTERPAgent"
if (Test-Path (Join-Path $DefaultAgentDir "SLTSERPagent.csproj")) {
    $ProjectDir = $DefaultAgentDir
} else {
    $ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$OutputDir = Join-Path $ProjectDir "publish"
$ExePath = Join-Path $OutputDir "SLTSERPagent.exe"
$CertSubject = "SLTS ERP Agent"
$SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SLTS ERP Agent - Build, Sign & Package" -ForegroundColor Cyan
Write-Host "  Project: $ProjectDir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Find or create code signing cert
Write-Host "`n[1/5] Checking code signing certificate..." -ForegroundColor Yellow
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*$CertSubject*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "  Creating new self-signed code signing certificate..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=$CertSubject, O=SLTS, L=Colombo, C=LK" -CertStoreLocation "Cert:\CurrentUser\My" -HashAlgorithm SHA256 -KeyLength 2048 -NotAfter (Get-Date).AddYears(3)
    
    # Install to Trusted Root and Trusted Publisher
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $rootStore.Open("ReadWrite"); $rootStore.Add($cert); $rootStore.Close()
    
    $pubStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "CurrentUser")
    $pubStore.Open("ReadWrite"); $pubStore.Add($cert); $pubStore.Close()
    
    Write-Host "  Certificate created and trusted: $($cert.Thumbprint)" -ForegroundColor Green
} else {
    Write-Host "  Using existing cert: $($cert.Thumbprint) (expires $($cert.NotAfter))" -ForegroundColor Green
}

# Step 2: Build
Write-Host "`n[2/5] Building release..." -ForegroundColor Yellow
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }

dotnet publish "$ProjectDir\SLTSERPagent.csproj" `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=false `
    -p:PublishTrimmed=false `
    -p:PublishReadyToRun=false `
    -o $OutputDir

if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; exit 1 }
Write-Host "  Build OK: $([math]::Round((Get-Item $ExePath).Length/1MB, 1)) MB" -ForegroundColor Green

# Step 3: Sign
Write-Host "`n[3/5] Code signing..." -ForegroundColor Yellow
if (Test-Path $SignTool) {
    & $SignTool sign /sha1 $cert.Thumbprint /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 $ExePath
    if ($LASTEXITCODE -ne 0) { Write-Host "SIGN FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "  Signed with SHA256 + RFC3161 timestamp" -ForegroundColor Green

    Write-Host "  Verifying signature..." -ForegroundColor Yellow
    $verifyOutput = & $SignTool verify /pa $ExePath 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "VERIFY FAILED: $verifyOutput" -ForegroundColor Red; exit 1 }
    Write-Host "  Signature verified OK" -ForegroundColor Green
} else {
    Write-Host "  SignTool not found at $SignTool - skipping signing step" -ForegroundColor Yellow
}

# Export cert for other machines
$CerPath = Join-Path $OutputDir "SLTSERPagent.cer"
Export-Certificate -Cert $cert -FilePath $CerPath -Type CERT | Out-Null
Write-Host "  Certificate exported: $CerPath" -ForegroundColor Green

# Step 4: Ensure config.json is present
Write-Host "`n[4/5] Preparing config.json..." -ForegroundColor Yellow
$ConfigSrc = Join-Path $ProjectDir "config.json"
$ConfigDst = Join-Path $OutputDir "config.json"
if (-not (Test-Path $ConfigSrc)) {
    $defaultJson = @'
{
  "baseUrl": "https://sltserp.vercel.app",
  "apiKey": "slts-agent-secure-sync-key-2026"
}
'@
    [System.IO.File]::WriteAllText($ConfigSrc, $defaultJson, [System.Text.Encoding]::UTF8)
}
Copy-Item -Path $ConfigSrc -Destination $ConfigDst -Force
Write-Host "  config.json bundled to publish directory" -ForegroundColor Green

# Step 5: Package ZIP
Write-Host "`n[5/5] Creating distribution ZIP package..." -ForegroundColor Yellow
$ZipPath = Join-Path $OutputDir "SLTSERPagent_setup.zip"
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }

Compress-Archive -Path $ExePath, $ConfigDst, $CerPath -DestinationPath $ZipPath -Force

Write-Host "  ZIP created: $ZipPath ($([math]::Round((Get-Item $ZipPath).Length/1MB, 1)) MB)" -ForegroundColor Green

# Copy to Desktop root as well
$DesktopZip = "C:\Users\Prasad\Desktop\SLTSERPagent_setup.zip"
Copy-Item -Path $ZipPath -Destination $DesktopZip -Force
Write-Host "  Copied to: $DesktopZip" -ForegroundColor Green

# Compute SHA-256 for release verification
$ExeHash = (Get-FileHash -Path $ExePath -Algorithm SHA256).Hash.ToLower()
$ZipHash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLower()

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  PACKAGE READY FOR DEPLOYMENT" -ForegroundColor Green
Write-Host "  EXE Path:    $ExePath" -ForegroundColor Cyan
Write-Host "  EXE SHA-256: $ExeHash" -ForegroundColor Cyan
Write-Host "  ZIP Path:    $DesktopZip" -ForegroundColor Cyan
Write-Host "  ZIP SHA-256: $ZipHash" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

