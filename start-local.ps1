# start-local.ps1 — boot the full Melody Map stack on this machine.
# Idempotent: skips anything already running. Safe to run any time.
#   Backend  -> http://127.0.0.1:5000  (Flask, logs: backend\local-backend.*.log)
#   Frontend -> http://127.0.0.1:3000  (Vite,  logs: frontend\local-vite.*.log)
# Open the app at http://127.0.0.1:3000  (use 127.0.0.1, NOT localhost —
# auth cookies are bound to that exact host).

$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

function Test-Port([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# ── Backend ──────────────────────────────────────────────────────────────────
if (Test-Port 5000) {
    Write-Host "backend  : already running on :5000"
} else {
    $python = Join-Path $backend '.venv\Scripts\python.exe'
    if (-not (Test-Path $python)) { $python = Join-Path $backend 'venv\Scripts\python.exe' }
    Start-Process -FilePath $python -ArgumentList '-u', 'app.py' -WorkingDirectory $backend `
        -RedirectStandardOutput (Join-Path $backend 'local-backend.out.log') `
        -RedirectStandardError  (Join-Path $backend 'local-backend.err.log') `
        -WindowStyle Hidden | Out-Null
    Write-Host "backend  : starting on :5000 ..."
}

# ── Frontend ─────────────────────────────────────────────────────────────────
if (Test-Port 3000) {
    Write-Host "frontend : already running on :3000"
} else {
    $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npm) { $npm = (Get-Command npm -ErrorAction Stop).Source }
    Start-Process -FilePath $npm -ArgumentList 'run', 'dev' -WorkingDirectory $frontend `
        -RedirectStandardOutput (Join-Path $frontend 'local-vite.out.log') `
        -RedirectStandardError  (Join-Path $frontend 'local-vite.err.log') `
        -WindowStyle Hidden | Out-Null
    Write-Host "frontend : starting on :3000 ..."
}

# ── Wait for health ──────────────────────────────────────────────────────────
$deadline = (Get-Date).AddSeconds(60)
$backendUp = $false
$frontendUp = $false
while ((Get-Date) -lt $deadline -and -not ($backendUp -and $frontendUp)) {
    if (-not $backendUp) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 4
            $backendUp = $true
            Write-Host "backend  : UP (db: $($health.data.database.state))"
        } catch { }
    }
    if (-not $frontendUp -and (Test-Port 3000)) {
        $frontendUp = $true
        Write-Host "frontend : UP"
    }
    if (-not ($backendUp -and $frontendUp)) { Start-Sleep -Seconds 2 }
}

if ($backendUp -and $frontendUp) {
    Write-Host ""
    Write-Host ">>> Melody Map is ready: http://127.0.0.1:3000" -ForegroundColor Green
} else {
    if (-not $backendUp)  { Write-Host "backend did not come up - check backend\local-backend.err.log" -ForegroundColor Yellow }
    if (-not $frontendUp) { Write-Host "frontend did not come up - check frontend\local-vite.err.log" -ForegroundColor Yellow }
}
