<#
.SYNOPSIS
    SeaHorse — Dev server manager (PowerShell)
    Kills any existing Next.js dev server on ports 3000/3001 before starting
    a fresh instance. Prevents "Internal Server Error" from stale zombie servers.
.EXAMPLE
    .\scripts\dev.ps1
    .\scripts\dev.ps1 -Port 3001
#>

param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

# ─── Colors ──────────────────────────────────────────────────────────────────
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  ✗ $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }

Write-Host "`n  ╔══════════════════════════════════════════╗"
Write-Host "  ║    SeaHorse — Dev Server Manager         ║"
Write-Host "  ╚══════════════════════════════════════════╝"
Write-Host ""

# ─── 1. Find project root ───────────────────────────────────────────────────
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptDirName = Split-Path -Leaf $ScriptRoot
if ($ScriptDirName -eq 'scripts') {
    $ProjectRoot = Resolve-Path "$ScriptRoot\.."
} else {
    $ProjectRoot = $ScriptRoot
}
Push-Location $ProjectRoot

# ─── 2. Find and kill existing Next.js processes ─────────────────────────────
Write-Host "  ─── Step 1: Cleaning up old servers ───"
Write-Host ""

$KILLED_ANY = $false
$TARGET_PORTS = @(3000, 3001)

# Method 1: Kill by port via netstat (Windows native)
Write-Info "Checking ports $($TARGET_PORTS -join ', ') ..."
foreach ($p in $TARGET_PORTS) {
    $connections = netstat -ano 2>$null | Select-String ":$p\s" | Select-String "LISTEN"
    foreach ($conn in $connections) {
        $parts = $conn -split '\s+'
        if ($parts.Count -ge 5) {
            $pid = $parts[-1]
            try {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc -and $proc.ProcessName -match 'node') {
                    Write-Warn "Port $p — killing node.exe (PID $pid)"
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    $KILLED_ANY = $true
                }
            } catch {}
        }
    }
}

# Method 2: Kill any stray next / node processes by window title
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
foreach ($proc in $nodeProcs) {
    try {
        $mainTitle = $proc.MainWindowTitle
        if ($mainTitle -match 'next|dev|SeaHorse') {
            Write-Warn "Killing node.exe — window title: '$mainTitle' (PID $($proc.Id))"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $KILLED_ANY = $true
        }
    } catch {
        # Some processes don't have a main window title — skip
    }
}

# Method 3: Kill by process matching "next dev" in command line
$wmiProcs = Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
foreach ($proc in $wmiProcs) {
    if ($proc.CommandLine -match 'next.*dev') {
        Write-Warn "Killing node.exe — running 'next dev' (PID $($proc.ProcessId))"
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        $KILLED_ANY = $true
    }
}

if (-not $KILLED_ANY) {
    Write-OK "No stale servers found — clean slate"
}

# Wait for ports to release
Start-Sleep -Seconds 2

# ─── 3. Verify ports are free ───────────────────────────────────────────────
Write-Host "`n  ─── Step 2: Verifying ports ───"
Write-Host ""

$PORTS_CLEAR = $true
foreach ($p in $TARGET_PORTS) {
    $connections = netstat -ano 2>$null | Select-String ":$p\s" | Select-String "LISTEN"
    if ($connections) {
        Write-Fail "Port $p is still in use"
        $PORTS_CLEAR = $false
    } else {
        Write-OK "Port $p is free"
    }
}

if (-not $PORTS_CLEAR) {
    Write-Host ""
    Write-Fail "Cannot start dev server — ports still occupied. Run:"
    Write-Info "npx kill-port 3000 3001"
    Pop-Location
    exit 1
}

# ─── 4. Start fresh dev server ──────────────────────────────────────────────
Write-Host "`n  ─── Step 3: Starting Next.js dev server ───"
Write-Info "Port: $Port"
Write-Info "URL:  http://localhost:$Port"
Write-Info "Press Ctrl+C to stop"
Write-Host ""

$env:PORT = $Port
npx next dev --port $Port

Pop-Location
