<#
.SYNOPSIS
    SeaHorse — Setup automatizado (Windows PowerShell)
    Instala dependencias (npm + pip), instala navegadores Playwright/Patchright,
    y crea .env desde .env.example.

    La configuración de API keys y perfil se realiza desde el wizard web
    en http://localhost:3000/setup después de iniciar el dashboard.
.EXAMPLE
    .\scripts\setup.ps1
    .\scripts\setup.ps1 -RepoPath C:\Users\Juan\proyectos\seahorse
#>

param(
    [string]$RepoPath = "$PWD\SeaHorse"
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

# ─── 1. Check Prerequisites ─────────────────────────────────────────────────
Write-Step "1/6  Verificando prerrequisitos"

$allGood = $true

# Node.js
try {
    $nodeVer = node --version 2>$null
    $verNum = [version]($nodeVer -replace '[vV]','')
    if ($verNum -ge [version]"20.0.0") {
        Write-OK "Node.js $nodeVer"
    } else {
        Write-Warn "Node.js $nodeVer — se requiere >= 20.x. Descarga: https://nodejs.org"
        $allGood = $false
    }
} catch {
    Write-Fail "Node.js no encontrado. Descarga: https://nodejs.org"
    $allGood = $false
}

# Python
try {
    $pyVer = python --version 2>&1
    Write-OK "Python $pyVer"
} catch {
    Write-Info "Python no encontrado (opcional — necesario solo para scrapers Python)"
}

# Git
try {
    $gitVer = git --version 2>&1
    Write-OK $gitVer
} catch {
    Write-Fail "Git no encontrado. Descarga: https://git-scm.com"
    $allGood = $false
}

# Docker (optional)
try {
    docker --version 2>$null | Out-Null
    Write-OK "Docker $(docker --version 2>$null) (opcional — Jina Reader self-hosted)"
} catch {
    Write-Info "Docker no encontrado (opcional)"
}

if (-not $allGood) {
    Write-Fail "Corrige los errores arriba y vuelve a ejecutar el script."
    exit 1
}

# ─── 2. Clone / Pull repo ──────────────────────────────────────────────────
Write-Step "2/6  Clonando repositorio"

if (Test-Path "$RepoPath") {
    Write-OK "Carpeta '$RepoPath' ya existe — haciendo git pull..."
    Push-Location $RepoPath
    Invoke-Native { git pull --ff-only } "git pull falló"
    Write-OK "git pull completado"
    Pop-Location
} else {
    Write-Host "    Clonando en: $RepoPath"
    Invoke-Native { git clone https://github.com/byAyes/SeaHorse.git $RepoPath } "git clone falló"
    Write-OK "Repo clonado"
}

Push-Location $RepoPath

# ─── 3. .env ────────────────────────────────────────────────────────────────
Write-Step "3/6  Creando archivo .env"

if (Test-Path ".env") {
    Write-OK ".env ya existe — se mantiene"
} else {
    Copy-Item ".env.example" ".env"
    Write-OK ".env creado desde .env.example"
    Write-Host ""
    Write-Host "    Las API keys (Gemini, JSearch, etc.) se configuran desde el"
    Write-Host "    wizard web en http://localhost:3000/setup después de iniciar el dashboard."
    Write-Host "    También puedes editar .env manualmente si lo prefieres."
    Write-Host ""
}

# ─── 4. npm install ─────────────────────────────────────────────────────────
Write-Step "4/6  Instalando dependencias Node.js (npm install)"

Invoke-Native {
    npm install --legacy-peer-deps 2>&1
} "npm install falló. Revisa la conexión a internet y vuelve a intentar."
Write-OK "npm install completado"

# ─── 5. pip install (opcional) ────────────────────────────────────────────────
Write-Step "5/6  Instalando dependencias Python (pip)"

try {
    Invoke-Native {
        pip install -r scrapers/requirements.txt 2>&1
    } "pip install falló. Activa tu virtualenv o revisa la instalación de Python."
    Write-OK "pip install completado"
} catch {
    Write-Warn "pip install falló — los scrapers Python no estarán disponibles (opcional)"
}

# ─── 6. Playwright + Patchright browsers ────────────────────────────────────
Write-Step "6/6  Instalando navegadores (Playwright + Patchright)"

Write-Host "    Instalando Playwright Chromium..."
try {
    Invoke-Native {
        playwright install chromium 2>&1
    } "playwright install chromium falló"
    Write-OK "Playwright Chromium instalado"
} catch {
    Write-Warn "playwright install chromium falló (no crítico)"
}

Write-Host "    Instalando Patchright Chromium..."
try {
    Invoke-Native {
        patchright install chromium 2>&1
    } "patchright install chromium falló"
    Write-OK "Patchright Chromium instalado"
} catch {
    Write-Warn "patchright install chromium falló (no crítico)"
}

# ─── Finish ──────────────────────────────────────────────────────────────────
Write-Step "✅  Instalación completada"
Write-Host ""
Write-Host "    Para iniciar el dashboard:"
Write-Host "        .\scripts\dev.ps1"
Write-Host "        # o: npm run dev"
Write-Host ""
Write-Host "    Luego abre http://localhost:3000/setup para configurar"
Write-Host "    tus API keys y perfil desde el wizard web."
Write-Host ""
Write-Host "    Para ejecutar el pipeline desde terminal:"
Write-Host "        npx tsx scripts/run-profile-pipeline.ts ruta/al/cv.pdf"
Write-Host ""

Pop-Location
