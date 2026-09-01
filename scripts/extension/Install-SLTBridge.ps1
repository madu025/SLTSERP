<#
.SYNOPSIS
    Install SLT-ERP Bridge extension via Chrome enterprise policy (force-install).

.DESCRIPTION
    Writes the ExtensionInstallForcelist registry policy to force-install the
    SLT-ERP Bridge extension from the hosted CRX + update manifest.

    Requires Admin for -Hive machine (HKLM). Standard users can use -Hive user (HKCU).
    For mass deployment, run as SYSTEM via Intune/SCCM/GPO logon script.

.PARAMETER Mode
    Installation mode. Only 'enterprise' is supported (registry policy install).

.PARAMETER ExtensionId
    Chrome extension ID. Default: mhbnhnpammnagfmgomcpakeeohbnkajm

.PARAMETER UpdateManifest
    URL to the update manifest XML. Default: https://sltserp.vercel.app/slt-bridge-updates.xml

.PARAMETER Hive
    Registry hive: 'machine' (HKLM, requires Admin) or 'user' (HKCU). Default: machine

.PARAMETER Uninstall
    Remove the force-install policy (extension remains installed but no longer managed).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File Install-SLTBridge.ps1
    # Installs for all users (requires Admin)

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File Install-SLTBridge.ps1 -Hive user
    # Installs for current user only (no Admin required)

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File Install-SLTBridge.ps1 -Uninstall
    # Removes the force-install policy
#>

param(
    [ValidateSet('enterprise')]
    [string]$Mode = 'enterprise',

    [string]$ExtensionId = 'mhbnhnpammnagfmgomcpakeeohbnkajm',

    [string]$UpdateManifest = 'https://sltserp.vercel.app/slt-bridge-updates.xml',

    [ValidateSet('machine', 'user')]
    [string]$Hive = 'machine',

    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$RegistryPath = if ($Hive -eq 'machine') {
    'HKLM:\Software\Policies\Google\Chrome\ExtensionInstallForcelist'
} else {
    'HKCU:\Software\Policies\Google\Chrome\ExtensionInstallForcelist'
}

$PolicyValue = "${ExtensionId};${UpdateManifest}"

if ($Uninstall) {
    Write-Host "Removing SLT-ERP Bridge force-install policy..." -ForegroundColor Yellow
    if (Test-Path $RegistryPath) {
        $existing = Get-ItemProperty -Path $RegistryPath -ErrorAction SilentlyContinue
        $props = $existing.PSObject.Properties | Where-Object { $_.Value -eq $PolicyValue }
        if ($props) {
            Remove-ItemProperty -Path $RegistryPath -Name $props.Name
            Write-Host "Policy removed: $($props.Name)" -ForegroundColor Green
        } else {
            Write-Host "Policy value not found." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Registry path does not exist. Nothing to remove." -ForegroundColor Yellow
    }
    exit 0
}

# Check Admin for HKLM
if ($Hive -eq 'machine') {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Error "Admin privileges required for -Hive machine. Re-run as Administrator or use -Hive user."
        exit 1
    }
}

# Create registry path if missing
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
    Write-Host "Created registry path: $RegistryPath" -ForegroundColor Cyan
}

# Find next available index (1, 2, 3...)
$existing = Get-ItemProperty -Path $RegistryPath -ErrorAction SilentlyContinue
$index = 1
while ($existing."$index") { $index++ }

# Write policy
Set-ItemProperty -Path $RegistryPath -Name "$index" -Value $PolicyValue -Type String
Write-Host "SLT-ERP Bridge force-install policy written:" -ForegroundColor Green
Write-Host "  Index: $index" -ForegroundColor Gray
Write-Host "  Value: $PolicyValue" -ForegroundColor Gray
Write-Host "  Hive:  $Hive" -ForegroundColor Gray
Write-Host ""
Write-Host "Restart Chrome to apply. Verify at chrome://policy → Reload policies" -ForegroundColor Cyan
