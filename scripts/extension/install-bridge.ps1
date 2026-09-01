<#
.SYNOPSIS
    Stages / installs / removes the SLT-ERP Bridge for Chrome, Edge and Firefox.

.DESCRIPTION
    Modes
      stage     Copy the unpacked extension to a stable path under %LOCALAPPDATA%
                and open the right extensions page. Needs the browser Developer
                mode toggle on - this is the two-click fallback.
      policy    No developer mode at all. Chrome and Edge honour the
                ExtensionInstallForcelist policy in HKCU, so a self-hosted CRX3
                (built with the repo signing key) installs silently on next start.
                Only touches HKCU - no admin rights, existing entries preserved.
      firefox   Builds a Firefox-compatible .xpi from the same sources and prints
                the three ways to get it permanently installed.
      uninstall Removes only this extension's policy entries.
      status    Shows what is currently staged / enforced on this machine.

    Nothing in this script sends anything anywhere; the only outbound dependency
    is the browser fetching the .crx from -UpdateUrlBase in policy mode, which
    must already be deployed (public/slt-bridge.crx + public/slt-bridge-updates.xml).

.EXAMPLE
    ./scripts/extension/install-bridge.ps1                       # stage + open page
    ./scripts/extension/install-bridge.ps1 -Mode policy -WhatIf  # dry run
    ./scripts/extension/install-bridge.ps1 -Mode uninstall
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('stage', 'policy', 'firefox', 'uninstall', 'status')]
    [string] $Mode = 'stage',

    [ValidateSet('chrome', 'edge', 'all')]
    [string] $Browser = 'all',

    # Must be an HTTPS origin that actually serves slt-bridge.crx and
    # slt-bridge-updates.xml after the next deploy.
    [string] $UpdateUrlBase = 'https://sltserp.vercel.app',

    [string] $GeckoId = 'slt-erp-bridge@slts.lk'
)

$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ExtSource  = Join-Path $RepoRoot 'public\slt-bridge'
$Builder    = Join-Path $PSScriptRoot 'build-bridge.mjs'
$StageRoot  = Join-Path $env:LOCALAPPDATA 'SLT-ERP\Bridge'
$Manifest   = Get-Content (Join-Path $ExtSource 'manifest.json') -Raw | ConvertFrom-Json
$Version    = $Manifest.version

# provider root -> policy key, so the loop below works for both Chromium browsers
$PolicyHives = [ordered]@{
    chrome = 'HKCU:\Software\Policies\Google\Chrome'
    edge   = 'HKCU:\Software\Policies\Microsoft\Edge'
}

function Invoke-Bridge {
    param([string[]]$Arguments)
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'node is not on PATH - install Node.js first.'
    }
    $output = & node $Builder @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "build-bridge.mjs $($Arguments[0]) failed (exit $LASTEXITCODE): $output"
    }
    return ($output | Out-String).Trim()
}

function Get-BridgeId { return Invoke-Bridge @('id') }

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

function Get-TargetBrowsers {
    if ($Browser -ne 'all') { return @($Browser) }
    return @('chrome', 'edge') | Where-Object { Test-BrowserInstalled $_ }
}

function Copy-Stage {
    param([string]$Source, [string]$Destination)
    if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
}

function Show-Stage {
    $dest = Join-Path $StageRoot "v$Version"
    if ($PSCmdlet.ShouldProcess($dest, 'stage unpacked extension')) {
        Copy-Stage -Source $ExtSource -Destination $dest
        Set-Clipboard -Value $dest
    }
    Write-Host ''
    Write-Host "  SLT-ERP Bridge v$Version staged at:" -ForegroundColor Green
    Write-Host "    $dest" -ForegroundColor White
    Write-Host '  (that path is already on the clipboard)' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  Two clicks, per browser:' -ForegroundColor Cyan
    Write-Host '    Chrome : chrome://extensions  -> Developer mode -> Load unpacked -> paste path'
    Write-Host '    Edge   : edge://extensions    -> Developer mode -> Load unpacked -> paste path'
    Write-Host '    Firefox: needs its own package - run  ./scripts/extension/install-bridge.ps1 -Mode firefox' -ForegroundColor White
    Write-Host ''
    Write-Host '  Developer mode is only needed for this mode. For a click-free install' -ForegroundColor Yellow
    Write-Host '  that survives restarts on Chrome/Edge, run:  ' -NoNewline -ForegroundColor Yellow
    Write-Host './scripts/extension/install-bridge.ps1 -Mode policy' -ForegroundColor White
    Write-Host ''
    Write-Host '  After loading, open the ERP once so the bridge can record its origin:' -ForegroundColor DarkGray
    Write-Host "    $UpdateUrlBase/extension-download" -ForegroundColor DarkGray
}

function Set-ForcedInstall {
    param([string]$Hive, [string]$Entry)
    $values = @()
    if (Test-Path $Hive) {
        $existing = Get-ItemProperty -Path $Hive -Name ExtensionInstallForcelist -ErrorAction SilentlyContinue
        if ($existing) { $values = @($existing.PSObject.Properties |
            Where-Object { $_.Name -match '^\d+$' } | Sort-Object { [int]$_.Name } | ForEach-Object { $_.Value }) }
    }
    if ($values -contains $Entry) {
        Write-Host "    already enforced: $Entry" -ForegroundColor DarkGray
        return
    }
    # Chrome/Edge read this list as individually numbered REG_SZ values, so the
    # merge has to keep whatever an IT department already put there.
    $values = @($values) + $Entry
    if ($PSCmdlet.ShouldProcess($Hive, 'force-install bridge')) {
        if (-not (Test-Path $Hive)) { New-Item -Path $Hive -Force | Out-Null }
        for ($i = 0; $i -lt $values.Count; $i++) {
            New-ItemProperty -Path $Hive -Name ($i + 1) -Value $values[$i] -PropertyType String -Force | Out-Null
        }
    }
    Write-Host "    enforced: $Entry" -ForegroundColor White
}

function Show-Policy {
    $targets = Get-TargetBrowsers
    if (-not $targets) {
        Write-Warning 'Neither Chrome nor Edge was found - nothing to configure. Pass -Browser explicitly if needed.'
        return
    }
    $id = Get-BridgeId
    Write-Host ''
    Write-Host "  Building CRX3 for SLT-ERP Bridge v$Version" -ForegroundColor Cyan
    Write-Host "  extension id: $id" -ForegroundColor White
    if ($PSCmdlet.ShouldProcess('public\slt-bridge.crx', 'repack')) {
        Invoke-Bridge @('pack-crx')
        $xml = Invoke-Bridge @('updates-xml', '--base-url', $UpdateUrlBase) | ConvertFrom-Json
        Write-Host "  update manifest: $($xml.file)" -ForegroundColor DarkGray
    }
    $entry = "$id;$UpdateUrlBase/slt-bridge-updates.xml"

    Write-Host ''
    Write-Host '  Policy sources already present (these win over HKCU):' -ForegroundColor Cyan
    foreach ($name in $targets) {
        $machine = $PolicyHives[$name] -replace '^HKCU:', 'HKLM:'
        $managed = $false
        if (Test-Path $machine) {
            $managed = @(Get-Item -Path $machine | ForEach-Object { $_.GetValueNames() }) -contains 'ExtensionInstallForcelist'
        }
        if ($managed) {
            Write-Host "    $machine forces extensions itself - HKCU loses for conflicting ids" -ForegroundColor Yellow
        }
        else {
            Write-Host "    $machine : nothing enforced (HKCU will apply)" -ForegroundColor DarkGray
        }
    }

    Write-Host ''
    Write-Host '  Writing HKCU force-install entries:' -ForegroundColor Cyan
    foreach ($name in $targets) {
        Write-Host "  [$name]" -ForegroundColor White
        Set-ForcedInstall -Hive $PolicyHives[$name] -Entry $entry
    }

    Write-Host ''
    Write-Host '  Next steps:' -ForegroundColor Green
    Write-Host "   1. Commit + deploy public/slt-bridge.crx and public/slt-bridge-updates.xml"
    Write-Host "      (the browser downloads $UpdateUrlBase/slt-bridge.crx)"
    Write-Host '   2. Fully close and reopen the browser, then open chrome://policy'
    Write-Host '      and click Reload policies. Expect "SLT-ERP Bridge" with'
    Write-Host '      "Installed by enterprise policy" - no developer mode, no prompts.'
    Write-Host '   3. Roll back any time with:  ./scripts/extension/install-bridge.ps1 -Mode uninstall'
    Write-Host ''
    Write-Host '  Note: the browser will report that it is managed by your organisation,' -ForegroundColor Yellow
    Write-Host '  and a self-hosted force-install never auto-updates unless the .crx at' -ForegroundColor Yellow
    Write-Host '  that URL is replaced (Chrome re-checks the update manifest on a timer).' -ForegroundColor Yellow
}

function Remove-ForcedInstall {
    param([string]$Hive, [string]$Id)
    if (-not (Test-Path $Hive)) { Write-Host '    no policy key' -ForegroundColor DarkGray; return }
    $props = Get-Item -Path $Hive |
        ForEach-Object { $_.GetValueNames() } | Where-Object { $_ -match '^\d+$' }
    $kept = @()
    foreach ($p in $props) {
        $value = (Get-ItemProperty -Path $Hive -Name $p).$p
        if ($value -like "$Id;*") {
            if ($PSCmdlet.ShouldProcess("$Hive\$p", 'remove force-install')) {
                Remove-ItemProperty -Path $Hive -Name $p
            }
            Write-Host "    removed $p = $value" -ForegroundColor White
        }
        else { $kept += $value }
    }
    if ($kept.Count -gt 0 -and $PSCmdlet.ShouldProcess($Hive, 'renumber force-install list')) {
        # Chrome reads a contiguous numbered list, so re-pack whatever survived.
        foreach ($p in $props) { Remove-ItemProperty -Path $Hive -Name $p -ErrorAction SilentlyContinue }
        for ($i = 0; $i -lt $kept.Count; $i++) {
            New-ItemProperty -Path $Hive -Name ($i + 1) -Value $kept[$i] -PropertyType String -Force | Out-Null
        }
    }
}

function Show-Uninstall {
    $id = Get-BridgeId
    Write-Host ''
    Write-Host "  Removing force-install entries for $id" -ForegroundColor Cyan
    foreach ($name in @('chrome', 'edge')) {
        Write-Host "  [$name]" -ForegroundColor White
        Remove-ForcedInstall -Hive $PolicyHives[$name] -Id $id
    }
    if (Test-Path $StageRoot) {
        Write-Host ''
        Write-Host "  Staged copies left in place (delete manually if you want):" -ForegroundColor DarkGray
        Write-Host "    $StageRoot" -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host '  Restart the browser to drop the extension.' -ForegroundColor Green
}

function New-FirefoxXpi {
    $work = Join-Path $StageRoot "firefox\v$Version"
    Copy-Stage -Source $ExtSource -Destination $work
    # Firefox cannot run an MV3 service worker and needs an explicit add-on id.
    Invoke-Bridge @('firefox-manifest', '--out', $work, '--gecko-id', $GeckoId) | Out-Null
    $staged = Join-Path $StageRoot "slt-bridge-v$Version-firefox"
    $zip = "$staged.zip"
    $xpi = "$staged.xpi"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    if (Test-Path $xpi) { Remove-Item $xpi -Force }
    # An .xpi is just a zip with manifest.json at the archive root.
    Compress-Archive -Path (Join-Path $work '*') -DestinationPath $zip -Force
    Move-Item -Path $zip -Destination $xpi -Force
    return $xpi
}

function Show-Firefox {
    $id = Get-BridgeId
    $xpi = New-FirefoxXpi
    Write-Host ''
    Write-Host "  built: $xpi" -ForegroundColor Green
    Write-Host "  gecko id: $GeckoId   (Chromium id, for reference: $id)" -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  Firefox is the one browser that never has a developer mode, but release' -ForegroundColor Yellow
    Write-Host '  Firefox refuses unsigned add-ons. Pick one:' -ForegroundColor Yellow
    Write-Host '    a) Sign it once, free: submit the .xpi to addons.mozilla.org as an'
    Write-Host '       unlisted ("self-hosted") add-on. Automated validation, no review fee,'
    Write-Host '       and the signed file then installs from any page with a normal prompt.'
    Write-Host '    b) Firefox Developer Edition / Nightly / ESR: set'
    Write-Host '       xpinstall.signatures.required = false in about:config, then install the .xpi.'
    Write-Host '    c) Temporary (resets on restart): about:debugging#/runtime/this-firefox'
    Write-Host '       -> Load Temporary Add-on -> select the manifest.json in the staged folder.'
    Write-Host ''
    Write-Host '  The Firefox build differs only in manifest.json (background.scripts + gecko id).' -ForegroundColor DarkGray
}

function Show-Status {
    $id = Get-BridgeId
    Write-Host ''
    Write-Host "  SLT-ERP Bridge v$Version   id $id" -ForegroundColor Cyan
    Write-Host '  Staged copies:' -ForegroundColor White
    if (Test-Path $StageRoot) {
        Get-ChildItem $StageRoot -Directory | ForEach-Object { Write-Host "    $($_.FullName)" -ForegroundColor DarkGray }
    }
    else { Write-Host '    none' -ForegroundColor DarkGray }
    Write-Host '  Force-install policy:' -ForegroundColor White
    foreach ($name in @('chrome', 'edge')) {
        $hive = $PolicyHives[$name]
        if (Test-Path $hive) {
            $props = Get-Item -Path $hive | ForEach-Object { $_.GetValueNames() } | Where-Object { $_ -match '^\d+$' }
            $hits = @($props | Where-Object { (Get-ItemProperty -Path $hive -Name $_).$_ -like "$id;*" })
            Write-Host ("    {0,-6} {1}" -f $name, $(if ($hits.Count) { "enforced ($($hits -join ', '))" } else { 'not enforced' }))
        }
        else { Write-Host "    $name  : no policy key" -ForegroundColor DarkGray }
    }
}

Write-Host ''
Write-Host "=== SLT-ERP Bridge installer ($Mode) ===" -ForegroundColor Cyan
switch ($Mode) {
    'stage'     { Show-Stage }
    'policy'    { Show-Policy }
    'firefox'   { Show-Firefox }
    'uninstall' { Show-Uninstall }
    'status'    { Show-Status }
}
