$ErrorActionPreference = 'Stop'

$InstallerDir = Join-Path $PSScriptRoot 'installer'
$OutputDir = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) (Join-Path 'dist' 'installer')

if (-not (Test-Path $InstallerDir)) {
    Write-Error "Installer source not found: $InstallerDir"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "=== Building SLT-ERP Bridge Installer ===" -ForegroundColor Cyan
Write-Host "Source: $InstallerDir" -ForegroundColor Gray
Write-Host "Output: $OutputDir" -ForegroundColor Gray
Write-Host ""

Push-Location $InstallerDir
try {
    dotnet publish -c Release -o $OutputDir

    $exePath = Join-Path $OutputDir 'Install-SLTBridge.exe'
    if (Test-Path $exePath) {
        $size = (Get-Item $exePath).Length / 1MB
        Write-Host ""
        Write-Host "Build successful!" -ForegroundColor Green
        Write-Host "Output: $exePath" -ForegroundColor Gray
        Write-Host "Size:   $($size.ToString('F2')) MB" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Upload to GitHub Releases, then update /extension-download page link." -ForegroundColor Yellow
    } else {
        Write-Error "Build failed: executable not found"
        exit 1
    }
} finally {
    Pop-Location
}
