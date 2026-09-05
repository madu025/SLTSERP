# ==========================================================================
# SLTSERP - Smart Deploy (V2)
# ==========================================================================
# Builds the Next.js standalone bundle locally, ships it to a server and
# restarts the chosen compose stack there. The server never compiles the app.
#
#   ./smart-deploy.ps1                                                  # existing droplet, full stack
#   ./smart-deploy.ps1 -Ip 5.6.7.8 -Key D:\keys\vps.pem `
#                      -ComposeFile docker-compose.vps.yml              # VPS sync host (Supabase + Redis + nginx)
# ==========================================================================
param(
    [string]$Ip = "47.130.203.236",
    [string]$User = "ubuntu",
    [string]$Key = "D:\MyProject\SLTSERP\sltserpkey.pem",
    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$RemoteDir = "~/slts-erp",
    [string]$ProjectRoot = "D:\MyProject\SLTSERP",
    # Empty = every service in the compose file. Pass "app redis" to skip the proxy
    # while no TLS certificate exists yet on a freshly prepared box.
    [string]$Services = "",
    # Reuse the .next output of a previous run. The build is the slow part and
    # nothing in it changes when only deployment plumbing was edited.
    [switch]$SkipBuild
)

Write-Host "🚀 STARTING SMART DEPLOY (LOCAL BUILD + REMOTE RUN)..." -ForegroundColor Cyan

# 1. Local Build
Set-Location $ProjectRoot
if ($SkipBuild) {
    Write-Host "--- Step 1: Skipped (-SkipBuild, reusing the existing .next output) ---" -ForegroundColor Yellow
    if (-not (Test-Path ".next/standalone")) {
        Write-Host "No previous build found. Run again without -SkipBuild." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "--- Step 1: Running Local Build (Fast) ---" -ForegroundColor Yellow

    # Clean old build
    if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
    if (Test-Path "deploy.zip") { Remove-Item "deploy.zip" }

    # Run build. Through cmd.exe on purpose: the npm.ps1 shim on PATH aborts with
    # "variable '$LASTEXITCODE' cannot be retrieved" in a -NoProfile session, which reads as a
    # build failure even though nothing was compiled.
    cmd /c npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Local Build Failed." -ForegroundColor Red
        exit 1
    }
}

# 2. Prepare Deployment Bundle
Write-Host "--- Step 2: Preparing Deployment Bundle ---" -ForegroundColor Yellow
if (-not (Test-Path ".next/standalone")) {
    Write-Host "❌ Standalone build not found." -ForegroundColor Red
    exit 1
}

# Create temp staging folder
$staging = "deploy_staging"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging

# Copy necessary files to staging
Copy-Item -Recurse -Force ".next/standalone/*" $staging
Copy-Item -Recurse -Force "public" "$staging/"
Copy-Item -Recurse -Force ".next/static" "$staging/.next/"
Copy-Item -Recurse -Force "prisma" "$staging/"
Copy-Item -Force "docker-entrypoint.sh" "$staging/"
Copy-Item -Force "Dockerfile.prod" "$staging/"

# ---------------------------------------------------------------------------
# Prune dead weight. The tracing root is the workspace, so Next copies every file
# any route might read into .next/standalone: a generated docs page, the .NET
# extension installer, contract PDFs and Excel sheets, customer uploads, and
# Prisma query engines for four platforms this image cannot run. Measured on a
# real bundle that came to 247 MB compressed: about 376 MB of the payload was
# never loadable or never reachable on the container.
$before = (Get-ChildItem $staging -Recurse -File -Force | Measure-Object -Sum Length).Sum

# Safe for every stack: the runner is node:22-alpine, so engines built for another
# OS can never load, and *.tmp<digits> are debris from interrupted generate runs.
Get-ChildItem $staging -Recurse -File -Force | Where-Object {
    $_.Name -match '\.tmp\d+$' -or
    $_.Name -eq 'query_engine-windows.dll.node' -or
    $_.Name -match '^libquery_engine-(debian|rhel|darwin|freebsd|win|linux-gnu|linux-static)' -or
    $_.Name -eq 'tsconfig.tsbuildinfo'
} | Remove-Item -Force

# Next traces the workspace root, so the standalone folder carries a copy of the developer's
# .env. Left in, "unzip -o" would overwrite the repaired server .env with a stale one (and it
# is the reason secrets ended up in an image layer). compose passes env_file at runtime.
foreach ($secret in @('.env', '.env.local', '.env.docker', '.env.vercel')) {
    $p = Join-Path $staging $secret
    if (Test-Path -LiteralPath $p) { Remove-Item -Force -LiteralPath $p }
}

if ($ComposeFile -eq "docker-compose.vps.yml") {
    # The sync host only answers /api/cron/*; each of these is read by a UI, download
    # or upload route that keeps running on Vercel.
    foreach ($d in @('docs', 'Agreement', 'Contractor_invoice', 'FN Material Reports-2026',
                     'OSP-Account', 'QGIS Project Template', 'KL-SVK-0567', 'SM-HJJ-0508-AB',
                     'memory', 'tests', 'test-results', 'QA-Test-Assets', 'postgres-init',
                     'dist', 'uploads', 'scripts/extension', 'api', 'design',
                     'ai-tasks', 'docker', 'monitoring')) {
        $p = Join-Path $staging $d
        if (Test-Path -LiteralPath $p) { Remove-Item -Recurse -Force -LiteralPath $p }
    }
}

$after = (Get-ChildItem $staging -Recurse -File -Force | Measure-Object -Sum Length).Sum
Write-Host ("   pruned {0:N1} MB of traced-in dead weight ({1:N1} MB -> {2:N1} MB)" -f `
    (($before - $after) / 1MB), ($before / 1MB), ($after / 1MB)) -ForegroundColor Green

# "COPY . ." runs against this folder on the server, so the repository .dockerignore
# must not be reused - it hides .next and node_modules, i.e. the app itself. The
# bundle needs its own: the archive, private keys and .env must never be baked into
# an image layer (compose injects the environment at runtime instead).
Set-Content -Path (Join-Path $staging '.dockerignore') -Encoding ascii -Value @(
    'deploy.zip', '*.pem', '.env', 'docker-compose*.yml'
)

# Zip it
Compress-Archive -Path "$staging/*" -DestinationPath "deploy.zip" -Force
Remove-Item -Recurse -Force $staging

# 3. Upload and Deploy
Write-Host "--- Step 3: Uploading Bundle ---" -ForegroundColor Yellow
icacls "$Key" /inheritance:r /grant:r "$($env:username):R"

# nginx/ carries Dockerfile.nginx, Dockerfile.vps and templates/, both stacks build
# a proxy container from it, so it has to be present on a freshly prepared box.
scp -i "$Key" -o StrictHostKeyChecking=no "deploy.zip" ${User}@${Ip}:$RemoteDir/deploy.zip
scp -i "$Key" -o StrictHostKeyChecking=no "$ComposeFile" ${User}@${Ip}:$RemoteDir/$ComposeFile
scp -i "$Key" -o StrictHostKeyChecking=no -r "nginx" ${User}@${Ip}:$RemoteDir/
scp -i "$Key" -o StrictHostKeyChecking=no ".env" ${User}@${Ip}:$RemoteDir/.env

Write-Host "--- Step 4: Extracting and Starting on Server ---" -ForegroundColor Yellow
# unzip -o overwrites, it never deletes, and "COPY . ." then pulls whatever is still lying
# around back into the image: the first run on this box left 35 MB of Excel reports and an
# 18 MB src/ tree inside a supposedly lean container. So the sync host directory is emptied
# to a keep-list first, which makes the build context exactly equal to this bundle. Only the
# compose files, the proxy build folder, the runtime .env and the incoming archive survive -
# the database is Supabase and uploads live in a named docker volume, so nothing user-written
# is inside this directory. -maxdepth 1 keeps the wipe one level deep; rm -rf does the trees.
$stalePrune = ''
if ($ComposeFile -eq "docker-compose.vps.yml") {
    $stalePrune = 'find . -mindepth 1 -maxdepth 1 -not -name nginx -not -name .env -not -name deploy.zip -not -name docker-compose.yml -not -name docker-compose.prod.yml -not -name docker-compose.vps.yml -not -name docker-compose.monitoring.yml -print0 | xargs -0 -r rm -rf --'
}

$remoteCmd = @"
cd $RemoteDir
sudo apt-get install -y unzip
$stalePrune
unzip -o deploy.zip -d .
sudo docker compose -f $ComposeFile up -d --build $Services
"@

ssh -i "$Key" -o StrictHostKeyChecking=no ${User}@${Ip} $remoteCmd

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "SMART DEPLOY COMPLETE ($ComposeFile on $Ip)."
if ($ComposeFile -eq "docker-compose.vps.yml") {
    Write-Host "Sync host is up. Confirm the workers actually booted:"
    Write-Host "  ssh -i $Key $User@$Ip 'docker logs sltserp-app' | Select-String INSTRUMENTATION"
    Write-Host "Then move the clock: node scripts/setup-cron.js https://<your-domain>"
} else {
    Write-Host "URL: http://$Ip"
}
Write-Host "==========================================================================" -ForegroundColor Green
