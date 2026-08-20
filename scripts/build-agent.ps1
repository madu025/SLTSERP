# SLTSERP Agent - Build & Sign Script
# Rebuilds and code-signs the SLTSERPagent.exe to minimize Smart App Control blocks

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputDir = Join-Path $ProjectDir "publish"
$ExePath = Join-Path $OutputDir "SLTSERPagent.exe"
$CertSubject = "SLTS ERP Agent"
$SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SLTS ERP Agent - Build & Sign" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Find or create code signing cert
Write-Host "`n[1/4] Checking code signing certificate..." -ForegroundColor Yellow
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
Write-Host "`n[2/4] Building release..." -ForegroundColor Yellow
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
Write-Host "`n[3/4] Code signing..." -ForegroundColor Yellow
& $SignTool sign /sha1 $cert.Thumbprint /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 $ExePath
if ($LASTEXITCODE -ne 0) { Write-Host "SIGN FAILED" -ForegroundColor Red; exit 1 }
Write-Host "  Signed with SHA256 + RFC3161 timestamp" -ForegroundColor Green

# Step 4: Verify
Write-Host "`n[4/4] Verifying signature..." -ForegroundColor Yellow
$verifyOutput = & $SignTool verify /pa $ExePath 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "VERIFY FAILED: $verifyOutput" -ForegroundColor Red; exit 1 }
Write-Host "  Signature verified OK" -ForegroundColor Green

# Export cert for other machines
Export-Certificate -Cert $cert -FilePath (Join-Path $OutputDir "SLTSERPagent.cer") -Type CERT | Out-Null
Write-Host "  Certificate exported: publish\SLTSERPagent.cer" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host "  EXE: $ExePath" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round((Get-Item $ExePath).Length/1MB, 1)) MB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nTo install cert on another machine, double-click publish\SLTSERPagent.cer"
Write-Host "and install to 'Local Machine' > 'Trusted Root Certification Authorities'"
