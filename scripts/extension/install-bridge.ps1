<#
.SYNOPSIS
    Stages / packages / reports the SLT-ERP Bridge for Chrome, Edge and Firefox.

.DESCRIPTION
    Modes
      stage     Copy the unpacked extension to a stable path under %LOCALAPPDATA%
                and open the right extensions page. Needs the browser Developer
                mode toggle on - this is the two-click fallback.
      store     Produce the store upload packages in dist\extension-store: a
                Chromium zip for the Chrome Web Store and Edge Add-ons, and a
                Firefox .xpi for addons.mozilla.org. Store installs need no
                Developer mode, no admin rights, and update themselves - see
                docs/EXTENSION_STORE_PUBLISHING.md.
      firefox   Builds a Firefox-compatible .xpi from the same sources and prints
                the three ways to get it permanently installed.
      amo       Signs the Firefox .xpi through the addons.mozilla.org API
                (web-ext, unlisted channel) so it installs permanently from a
                link, no Developer mode. Reads AMO_JWT_ISSUER and
                AMO_JWT_SECRET from .env; the signed file lands in
                public\downloads\SLT-Bridge-Firefox.xpi.
      status    Shows what is currently staged / enforced on this machine.

    The old ExtensionInstallForcelist policy mode is gone: Windows 11 denies a
    standard user every browser policy key write, there is no AD domain to push
    policy from, and the stores cover the same need with auto-updates.

.EXAMPLE
    ./scripts/extension/install-bridge.ps1                       # stage + open page
    ./scripts/extension/install-bridge.ps1 -Mode store           # store upload packages
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('stage', 'store', 'firefox', 'amo', 'status')]
    [string] $Mode = 'stage',

    [ValidateSet('chrome', 'edge', 'all')]
    [string] $Browser = 'all',

    # Base URL the staged copy is told to sync against.
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
    Write-Host '  Developer mode is only needed for this mode. Store installs need' -ForegroundColor Yellow
    Write-Host '  none - build the upload packages with:  ' -NoNewline -ForegroundColor Yellow
    Write-Host './scripts/extension/install-bridge.ps1 -Mode store' -ForegroundColor White
    Write-Host ''
    Write-Host '  After loading, open the ERP once so the bridge can record its origin:' -ForegroundColor DarkGray
    Write-Host "    $UpdateUrlBase/extension-download" -ForegroundColor DarkGray
}

function Test-LocalDevPattern {
    # Returns $true for http:// / https:// / *:// match patterns that point
    # at localhost or 127.0.0.1. These dev-only entries are in the source
    # manifest but must NOT ship in store upload packages (CWS / Edge Add-ons /
    # AMO reject them). The source manifest itself is never modified.
    param([string]$Pattern)
    return $Pattern -match '^(http|https|\*):\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?(\/|$|\*)'
}

function Invoke-StripLocalDevFromManifest {
    param([string]$ManifestPath)
    $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
    if ($manifest.host_permissions) {
        $manifest.host_permissions = @($manifest.host_permissions | Where-Object { -not (Test-LocalDevPattern $_) })
    }
    if ($manifest.content_scripts) {
        foreach ($cs in $manifest.content_scripts) {
            $cs.matches = @($cs.matches | Where-Object { -not (Test-LocalDevPattern $_) })
        }
    }
    if ($manifest.web_accessible_resources) {
        foreach ($war in $manifest.web_accessible_resources) {
            $war.matches = @($war.matches | Where-Object { -not (Test-LocalDevPattern $_) })
        }
    }
    $manifest | ConvertTo-Json -Depth 10 | Set-Content $ManifestPath -Encoding UTF8
}

function Show-Store {
    $outDir = Join-Path $RepoRoot 'dist\extension-store'
    if ($PSCmdlet.ShouldProcess($outDir, 'build store upload packages')) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null

        # --- Strip dev-only (localhost) match patterns from the Chromium upload
        #     manifest. The source manifest must keep them for local development;
        #     CWS and Edge Add-ons reject http:// patterns, so we patch a copy
        #     inside a throwaway staging directory and zip THAT.
        $cwsWork = Join-Path $outDir '_cws-staging'
        if (Test-Path $cwsWork) { Remove-Item $cwsWork -Recurse -Force }
        Copy-Stage -Source $ExtSource -Destination $cwsWork
        Invoke-StripLocalDevFromManifest -ManifestPath (Join-Path $cwsWork 'manifest.json')

        # Chromium: the Chrome Web Store and Edge Add-ons take the same plain zip,
        # manifest.json at the archive root, no signing key inside.
        $chrome = Join-Path $outDir "slt-bridge-v$Version-chrome-cws.zip"
        if (Test-Path $chrome) { Remove-Item $chrome -Force }
        Compress-Archive -Path (Join-Path $cwsWork '*') -DestinationPath $chrome -Force
        Remove-Item $cwsWork -Recurse -Force

        $xpi = New-FirefoxXpi
        $xpiOut = Join-Path $outDir (Split-Path $xpi -Leaf)
        Copy-Item $xpi $xpiOut -Force
        Write-Host ''
        Write-Host "  Chrome Web Store + Edge Add-ons upload: $chrome  ($((Get-Item $chrome).Length) b)" -ForegroundColor Green
        Write-Host "  (localhost dev patterns stripped from this zip only - source manifest is unchanged)" -ForegroundColor DarkGray
        Write-Host "  Firefox (AMO) upload:                   $xpiOut  ($((Get-Item $xpiOut).Length) b)" -ForegroundColor Green
        Write-Host ''
        Write-Host '  Accounts, fees, permission justifications and the exact steps:' -ForegroundColor Cyan
        Write-Host '    docs/EXTENSION_STORE_PUBLISHING.md' -ForegroundColor White
        Write-Host ''
        Write-Host '  Store item ids will differ from the self-hosted id - expected;' -ForegroundColor DarkGray
        Write-Host '  the ERP page detects the bridge from the page, not the extension id.' -ForegroundColor DarkGray
    }
}

function Show-Amo {
    # AMO API credentials live in .env (git-ignored) - never in the repo.
    $amoKeys = @{}
    foreach ($line in (Get-Content (Join-Path $RepoRoot '.env'))) {
        if ($line -match '^\s*(AMO_[A-Z_]+)\s*=\s*(.+?)\s*$') { $amoKeys[$Matches[1]] = $Matches[2] }
    }
    if (-not ($amoKeys['AMO_JWT_ISSUER'] -and $amoKeys['AMO_JWT_SECRET'])) {
        Write-Error 'Put AMO_JWT_ISSUER and AMO_JWT_SECRET in .env first (addons.mozilla.org -> Tools -> Manage API Keys).'
        return
    }
    $outDir = Join-Path $RepoRoot 'dist\extension-store\amo'
    if ($PSCmdlet.ShouldProcess($outDir, 'sign the Firefox .xpi via the AMO API')) {
        $null = New-FirefoxXpi   # re-stages the patched sources into $StageRoot\firefox\v$Version
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        & npx --yes web-ext sign `
            --source-dir (Join-Path $StageRoot "firefox\v$Version") `
            --artifacts-dir $outDir `
            --channel unlisted `
            --api-key $amoKeys['AMO_JWT_ISSUER'] `
            --api-secret $amoKeys['AMO_JWT_SECRET'] `
            --timeout 300000
        if ($LASTEXITCODE -ne 0) {
            Write-Error 'web-ext sign failed - see the output above. "Version already exists" means: bump the manifest version and re-run.'
            return
        }
        # web-ext downloads the signed package as an .xpi (named <file-id>-<version>.xpi).
        $signed = Get-ChildItem $outDir -File |
            Where-Object { $_.Extension -in '.xpi', '.zip' } |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $signed) {
            Write-Error 'web-ext reported success but no signed package was found in the artifacts dir.'
            return
        }
        $target = Join-Path $RepoRoot 'public\downloads\SLT-Bridge-Firefox.xpi'
        Copy-Item $signed.FullName $target -Force
        Write-Host ''
        Write-Host "  signed package: $target  ($((Get-Item $target).Length) b)" -ForegroundColor Green
        Write-Host '  Commit + deploy it, then point the firefox entry in STORE_LINKS at' -ForegroundColor White
        Write-Host '  /downloads/SLT-Bridge-Firefox.xpi - clicking that link in Firefox' -ForegroundColor White
        Write-Host '  installs permanently, no Developer mode, no policy, no admin rights.' -ForegroundColor White
    }
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
    'stage'   { Show-Stage }
    'store'   { Show-Store }
    'firefox' { Show-Firefox }
    'amo'     { Show-Amo }
    'status'  { Show-Status }
}
