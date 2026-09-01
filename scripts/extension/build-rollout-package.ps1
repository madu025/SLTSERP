<#
.SYNOPSIS
    Builds the self-contained rollout package for the SLT-ERP Bridge.

.DESCRIPTION
    Produces dist/extension-rollout/SLT-Bridge-Rollout-vX.Y.Z/ (plus a zip of it)
    that a helpdesk can hand to 200 users without a repository, without Node and
    without admin rights:

      SLT-Bridge-vX.Y.Z.zip              unpacked extension for Load-unpacked
      SLT-Bridge-vX.Y.Z-firefox-unsigned.xpi  same build, Firefox manifest shape
      Install-SLTBridge.ps1              silent policy install / -Uninstall
      ForceInstall-SLTBridge.reg         same thing, double-click version
      RemoveForceInstall-SLTBridge.reg   rollback for the double-click version
      README.html                        staff + IT instructions (si/en)
      checksums.txt                      SHA-256 of everything above

    The extension id is derived from public/slt-bridge.pem, so it matches the CRX3
    that the ERP origin serves - that is what the browsers actually download. The
    Chromium zip and the Firefox xpi are packed from public/slt-bridge on every run.

.EXAMPLE
    ./scripts/extension/build-rollout-package.ps1
    ./scripts/extension/build-rollout-package.ps1 -UpdateManifest 'https://intranet/slt/updates.xml'
#>
[CmdletBinding()]
param(
    # Defaults to <repo>/dist/extension-rollout; $PSScriptRoot is still empty while
    # parameter binding runs, so the fallback is resolved in the body below.
    [string] $OutDir,
    [string] $UpdateManifest = 'https://sltserp.vercel.app/slt-bridge-updates.xml',
    [string] $ExtensionId,
    [int] $Slot = 90
)

$ErrorActionPreference = 'Stop'

$RepoRoot  = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'dist\extension-rollout' }
$RolloutSrc = Join-Path $PSScriptRoot 'rollout'
$ExtSrc     = Join-Path $RepoRoot 'public\slt-bridge'
$ManifestPath = Join-Path $ExtSrc 'manifest.json'
$BuildBridge = Join-Path $PSScriptRoot 'build-bridge.mjs'

if (-not (Test-Path $ManifestPath)) { throw "Missing $ManifestPath" }
$version = (Get-Content $ManifestPath -Raw | ConvertFrom-Json).version
if (-not $ExtensionId) {
    $ExtensionId = (& node $BuildBridge id | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $ExtensionId) { throw 'Could not derive the extension id from public/slt-bridge.pem.' }
}

$entry = "$ExtensionId;$UpdateManifest"
$name  = "SLT-Bridge-Rollout-v$version"
$pkg   = Join-Path $OutDir $name

Write-Host ''
Write-Host "=== Building $name ===" -ForegroundColor Cyan
Write-Host "  extension id : $ExtensionId" -ForegroundColor DarkGray
Write-Host "  update url   : $UpdateManifest" -ForegroundColor DarkGray

if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
New-Item -ItemType Directory -Path $pkg -Force | Out-Null

# Everything is packed straight out of public/slt-bridge in a temp tree, so a
# hand-out can never ship a build older than the source it was made from.
$work = Join-Path $OutDir '.work'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work -Force | Out-Null
$chromeCopy = Join-Path $work 'chrome'
Copy-Item $ExtSrc $chromeCopy -Recurse

# 1. Unpacked extension for "Load unpacked" - manifest.json must sit at the root
#    of the archive, hence the \* glob rather than the folder itself.
$bridgeZip = "SLT-Bridge-v$version.zip"
Compress-Archive -Path (Join-Path $chromeCopy '*') -DestinationPath (Join-Path $work 'bridge.zip') -Force
Move-Item (Join-Path $work 'bridge.zip') (Join-Path $pkg $bridgeZip) -Force

# 2. Firefox needs its own manifest (no MV3 service worker, mandatory add-on id).
#    Unsigned, so it only loads temporarily unless it goes through AMO signing.
$firefoxXpi = "SLT-Bridge-v$version-firefox-unsigned.xpi"
& node $BuildBridge firefox-manifest --out $chromeCopy | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Firefox manifest patch failed.' }
Compress-Archive -Path (Join-Path $chromeCopy '*') -DestinationPath (Join-Path $work 'firefox.zip') -Force
Move-Item (Join-Path $work 'firefox.zip') (Join-Path $pkg $firefoxXpi) -Force

# 3. The standalone installer (identical to the repo copy).
Copy-Item (Join-Path $RolloutSrc 'Install-SLTBridge.ps1') $pkg -Force

# 4. Double-click registry files. regedit merges these without touching value names
#    an IT department already uses, because we deliberately sit in a high slot.
$regHeader = @'
Windows Registry Editor Version 5.00

'@
$installReg = $regHeader + @"
; SLT-ERP Bridge v$version - silent install for Chrome and Edge (per-user policy).
; Requires a full browser restart, then chrome://policy -> Reload policies.
; Writes the fixed slot $Slot - use Install-SLTBridge.ps1 instead if that number
; is already taken by another forced extension on this machine.

[HKEY_CURRENT_USER\Software\Policies\Google\Chrome]
"$Slot"="$entry"

[HKEY_CURRENT_USER\Software\Policies\Microsoft\Edge]
"$Slot"="$entry"
"@
$removeReg = $regHeader + @"
; Removes only the SLT-ERP Bridge force-install entry (slot $Slot).

[HKEY_CURRENT_USER\Software\Policies\Google\Chrome]
"$Slot"=-

[HKEY_CURRENT_USER\Software\Policies\Microsoft\Edge]
"$Slot"=-
"@
Set-Content -Path (Join-Path $pkg 'ForceInstall-SLTBridge.reg') -Value $installReg -Encoding ASCII
Set-Content -Path (Join-Path $pkg 'RemoveForceInstall-SLTBridge.reg') -Value $removeReg -Encoding ASCII

# 5. Bilingual guide, stamped with this build's real values.
$template = Get-Content (Join-Path $RolloutSrc 'README-template.html') -Raw -Encoding UTF8
$readme = $template.
    Replace('{{VERSION}}', $version).
    Replace('{{ID}}', $ExtensionId).
    Replace('{{ZIP_NAME}}', $bridgeZip).
    Replace('{{XPI_NAME}}', $firefoxXpi).
    Replace('{{UPDATE_URL}}', $UpdateManifest)
Set-Content -Path (Join-Path $pkg 'README.html') -Value $readme -Encoding UTF8

# 6. Integrity list for whoever distributes this.
$files = Get-ChildItem $pkg -File | Where-Object Name -ne 'checksums.txt' | Sort-Object Name
$lines = $files | ForEach-Object { '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name }
Set-Content -Path (Join-Path $pkg 'checksums.txt') -Value $lines -Encoding ASCII

# 7. One archive to hand out.
$archive = Join-Path $OutDir "$name.zip"
if (Test-Path $archive) { Remove-Item $archive -Force }
Compress-Archive -Path (Join-Path $pkg '*') -DestinationPath $archive -Force
Remove-Item $work -Recurse -Force

Write-Host ''
Write-Host '  contents:' -ForegroundColor White
Get-ChildItem $pkg -File | ForEach-Object {
    Write-Host ("    {0,-38} {1,8:N0} b" -f $_.Name, $_.Length) -ForegroundColor DarkGray
}
Write-Host ''
Write-Host "  package folder : $pkg" -ForegroundColor Green
Write-Host "  hand-out zip   : $archive  ($((Get-Item $archive).Length) b)" -ForegroundColor Green
Write-Host ''
Write-Host '  Distribute: unzipped on a share, or push Install-SLTBridge.ps1 through' -ForegroundColor Yellow
Write-Host '  Intune/SCCM/GPO. Users without admin rights are fine - HKCU only.' -ForegroundColor Yellow
Write-Host ''
