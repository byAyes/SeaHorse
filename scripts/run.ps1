<#
.SYNOPSIS
    SeaHorse — Runner automatizado (Windows PowerShell)
    Por defecto inicia el dashboard web (Next.js).
    También puede ejecutar el pipeline de scraping + matching + email directamente.

    La configuración de API keys y perfil se realiza desde el wizard web
    en http://localhost:3000/setup después de iniciar el dashboard.
.PARAMETER CvPath
    Ruta al archivo CV/PDF para pipeline completo.
.PARAMETER Basic
    Ejecuta pipeline básico (scrape → match → email, sin CV).
.PARAMETER JinaReader
    Test Jina Reader standalone.
.EXAMPLE
    .\scripts\run.ps1
    .\scripts\run.ps1 -CvPath "C:\Users\Juan\Downloads\CV.pdf"
    .\scripts\run.ps1 -Basic
#>

param(
    [string]$CvPath = "",
    [switch]$Basic,
    [switch]$JinaReader
)

$ErrorActionPreference = "Stop"

# ─── Colors ──────────────────────────────────────────────────────────────────
function Write-Step($msg) {
    Write-Host "`n━━━ $msg ━━━" -ForegroundColor Cyan
}
function Write-OK($msg) {
    Write-Host "  ✓ $msg" -ForegroundColor Green
}
function Write-Warn($msg) {
    Write-Host "  ⚠ $msg" -ForegroundColor Yellow
}
function Write-Fail($msg) {
    Write-Host "  ✗ $msg" -ForegroundColor Red
}
function Write-Info($msg) {
    Write-Host "    $msg" -ForegroundColor DarkGray
}

# ─── Helper: run native command with LASTEXITCODE check ──────────────────────
function Invoke-Native {
    param([scriptblock]$ScriptBlock, [string]$ErrorMessage)
    & $ScriptBlock
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

# ─── Helper: get non-commented env var from .env ─────────────────────────────
function Get-EnvVar($name) {
    $lines = Get-Content ".env" -ErrorAction SilentlyContinue
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -match "^$name=(.+)" -and $trimmed -notmatch "your_.*_here|your_email") {
            return $Matches[1].Trim()
        }
    }
    return $null
}

# ─── 1. Prereqs check ───────────────────────────────────────────────────────
Write-Step "1/3  Verificando entorno"

try {
    $nodeVer = node --version 2>$null
    Write-OK "Node.js $nodeVer"
} catch {
    Write-Fail "Node.js no encontrado. Ejecuta primero: .\scripts\setup.ps1"
    exit 1
}

# Carpeta del proyecto
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptDirName = Split-Path -Leaf $ScriptRoot
if ($ScriptDirName -eq 'scripts') {
    $ProjectRoot = Resolve-Path "$ScriptRoot\.."
} else {
    $ProjectRoot = $ScriptRoot
}
Push-Location $ProjectRoot
Write-OK "Directorio: $ProjectRoot"

# ─── 2. Verificar .env ──────────────────────────────────────────────────────
Write-Step "2/3  Verificando configuración"

if (-not (Test-Path ".env")) {
    Write-Warn ".env no encontrado — las API keys se configuran desde el wizard web"
    Write-Info "      1. Inicia el dashboard: npm run dev"
    Write-Info "      2. Abre http://localhost:3000/setup"
    Write-Info "      3. Sigue el wizard para configurar tus keys"
    Write-Host ""
} elseif (-not (Get-EnvVar "GEMINI_API_KEY") -and -not (Get-EnvVar "OPENROUTER_API_KEY") -and -not (Get-EnvVar "NVIDIA_NIM_API_KEY")) {
    Write-Warn "No hay AI keys configuradas en .env"
    Write-Info "    Configúralas desde el wizard web en http://localhost:3000/setup"
    Write-Info "    O edita .env directamente con tus keys."
    Write-Host ""
} else {
    Write-OK "Configuración lista"
}

# ─── 3. Ejecutar ────────────────────────────────────────────────────────────
if ($CvPath) {
    Write-Step "3/3  Ejecutando pipeline completo"
    Write-Info "    CV: $CvPath"
    Write-Info "    Esto toma ~60-90 segundos...`n"
    Invoke-Native { npx tsx scripts/run-profile-pipeline.ts $CvPath 2>&1 } "Pipeline completo falló"

} elseif ($Basic) {
    Write-Step "3/3  Ejecutando pipeline básico (scrape → match → email)`n"
    Invoke-Native { npm run automate 2>&1 } "Pipeline básico falló"

} elseif ($JinaReader) {
    Write-Step "3/3  Ejecutando Jina Reader standalone`n"
    Write-Host "    Fuente (linkedin/indeed/computrabajo/glassdoor): " -NoNewline
    $jrSource = Read-Host
    if ($jrSource -eq '') { $jrSource = 'linkedin' }
    Write-Host "    Query (ej: software engineer): " -NoNewline
    $jrQuery = Read-Host
    if ($jrQuery -eq '') { $jrQuery = 'software engineer' }
    Write-Host "    Máx jobs (ej: 10): " -NoNewline
    $jrMax = Read-Host
    if ($jrMax -eq '') { $jrMax = '10' }
    Write-Host "`n"
    Invoke-Native { npx tsx src/scrapers/strategies/jinaReader.ts $jrSource $jrQuery $jrMax 2>&1 } "Jina Reader falló"

} else {
    # Default: dashboard
    Write-Step "3/3  Iniciando servidor de desarrollo Next.js"
    Write-Info "    Dashboard: http://localhost:3000"
    Write-Info "    Setup:     http://localhost:3000/setup"
    Write-Info "    Presiona Ctrl+C para detener`n"
    Invoke-Native { npm run dev 2>&1 } "npm run dev falló"
}

Pop-Location
