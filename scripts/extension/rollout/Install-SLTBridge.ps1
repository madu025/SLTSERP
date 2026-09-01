<#
.SYNOPSIS
    Standalone SLT-ERP Bridge installer for Chrome and Edge - no Developer mode,
    no admin rights, no repository checkout.

.DESCRIPTION
    Writes the per-user (HKCU) ExtensionInstallForcelist policy that makes Chrome
    and Edge install the bridge silently on next start. The browser itself downloads
    the signed CRX3 from the ERP origin over HTTPS, so nothing is copied around per
    machine and the extension keeps updating whenever the ERP is redeployed.

    Existing force-install entries (values named 1..n) are never overwritten: a free
    numbered slot from -StartSlot upwards is used, so an IT department that already
    enforces other extensions is left intact.

    Remove everything again with -Uninstall. Both operations only touch the two
    policy keys below - no other browser setting, no HKLM, no files outside the
    browser profile.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File Install-SLTBridge.ps1
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File Install-SLTBridge.ps1 -WhatIf
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File Install-SLTBridge.ps1 -Uninstall
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $ExtensionId = 'mhbnhnpammnagfmgomcpakeeohbnkajm',
    [string] $UpdateManifest = 'https://sltserp.vercel.app/slt-bridge-updates.xml',
    [ValidateSet('chrome', 'edge', 'all')] [string] $Browser = 'all',
    [ValidateRange(1, 999)] [int] $StartSlot = 90,
    [switch] $Uninstall
)

$ErrorActionPreference = 'Stop'

$Hives = [ordered]@{
    chrome = 'HKCU:\Software\Policies\Google\Chrome'
    edge   = 'HKCU:\Software\Policies\Microsoft\Edge'
}

function Test-BrowserInstalled {
    param([string]$Name)
    $paths = switch ($Name) {
        chrome { @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") }
        edge   { @(
            "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") }
    }
    return [bool]($paths | Where-Object { $_ -and (Test-Path $_) })
}

function Get-NumericValues {
    param([string]$Hive)
    if (-not (Test-Path $Hive)) { return @() }
    $names = Get-Item -Path $Hive | ForEach-Object { $_.GetValueNames() } | Where-Object { $_ -match '^\d+$' }
    return @($names | ForEach-Object {
        [pscustomobject]@{ Name = $_; Data = (Get-ItemProperty -Path $Hive -Name $_).$_ }
    })
}

function Install-Forced {
    param([string]$Name, [string]$Entry)
    $hive = $Hives[$Name]
    $current = Get-NumericValues -Hive $hive

    if ($current.Data -contains $Entry) {
        Write-Host "  [$Name]  already enforced (slot $(@($current | Where-Object Data -eq $Entry).Name))" -ForegroundColor DarkGray
        return
    }
    $taken = @($current.Name | ForEach-Object { [int]$_ })
    $slot = $StartSlot
    while ($taken -contains $slot) { $slot++ }

    if ($PSCmdlet.ShouldProcess($hive, 'force-install SLT-ERP Bridge')) {
        if (-not (Test-Path $hive)) { New-Item -Path $hive -Force | Out-Null }
        New-ItemProperty -Path $hive -Name "$slot" -Value $Entry -PropertyType String -Force | Out-Null
    }
    Write-Host "  [$Name]  enforced in slot $slot" -ForegroundColor Green
}

function Uninstall-Forced {
    param([string]$Name)
    $hive = $Hives[$Name]
    $mine = @(Get-NumericValues -Hive $hive | Where-Object { $_.Data -like "$ExtensionId;*" })
    if (-not $mine) {
        Write-Host "  [$Name]  nothing to remove" -ForegroundColor DarkGray
        return
    }
    foreach ($m in $mine) {
        if ($PSCmdlet.ShouldProcess("$hive\$($m.Name)", 'remove force-install')) {
            Remove-ItemProperty -Path $hive -Name $m.Name
        }
        Write-Host "  [$Name]  removed slot $($m.Name): $($m.Data)" -ForegroundColor Green
    }
}

$targets = if ($Browser -eq 'all') { @('chrome', 'edge') } else { @($Browser) }
$found = @($targets | Where-Object { Test-BrowserInstalled $_ })
if ($Browser -eq 'all' -and -not $found) { $found = $targets }
if (-not $found) {
    Write-Warning 'No Chrome or Edge installation was found on this machine.'
    return
}

$entry = "$ExtensionId;$UpdateManifest"

if (-not $Uninstall -and $UpdateManifest -notmatch '^https://') {
    # Chrome refuses a self-hosted force install that is not fetched over HTTPS.
    Write-Warning "-UpdateManifest should be an https:// URL or Chrome will ignore it."
}

Write-Host ''
Write-Host ('=== SLT-ERP Bridge {0} ===' -f $(if ($Uninstall) { 'removal' } else { 'force-install' })) -ForegroundColor Cyan
Write-Host "  target: $entry" -ForegroundColor White
Write-Host "  browsers: $($found -join ', ')" -ForegroundColor DarkGray
Write-Host ''

foreach ($name in $found) {
    if ($Uninstall) { Uninstall-Forced -Name $name } else { Install-Forced -Name $name -Entry $entry }
}

Write-Host ''
if ($Uninstall) {
    Write-Host '  Close the browser completely and reopen it - the extension disappears.' -ForegroundColor Green
}
else {
    Write-Host '  Last step (needed once):' -ForegroundColor Yellow
    Write-Host '   1. Close EVERY browser window (tray icons too), then reopen.'
    Write-Host '   2. Open chrome://policy  (or edge://policy) and click "Reload policies".'
    Write-Host '   3. chrome://extensions now lists "SLT-ERP Bridge - Installed by enterprise policy".'
    Write-Host ''
    Write-Host '  The browser will say it is managed by your organisation. Roll back any time with'
    Write-Host '  the same script and -Uninstall.' -ForegroundColor DarkGray
}
Write-Host ''
