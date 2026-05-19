<#
.SYNOPSIS
    SeaHorse — Setup automatizado (Node.js + Python + Playwright + .env)
.DESCRIPTION
    Clona el repo, instala dependencias (npm + pip), instala navegadores
    Playwright/Patchright, y crea .env desde .env.example.
    Solo copia y pega en PowerShell.
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

# ─── Helper: run native command with LASTEXITCODE check ──────────────────────
function Invoke-Native {
    param([scriptblock]$ScriptBlock, [string]$ErrorMessage)
    & $ScriptBlock
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

# ─── 1. Check Prerequisites ─────────────────────────────────────────────────
Write-Step "1/7  Verificando prerrequisitos"

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
    if ($pyVer -match '(\d+\.\d+)') {
        $verNum = [double]$Matches[1]
        if ($verNum -ge 3.12) {
            Write-OK "Python $pyVer"
        } else {
            Write-Warn "Python $pyVer — se requiere >= 3.12. Descarga: https://python.org"
            $allGood = $false
        }
    }
} catch {
    Write-Fail "Python no encontrado. Descarga: https://python.org"
    $allGood = $false
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
$hasDocker = $false
try {
    docker --version 2>$null | Out-Null
    Write-OK "Docker $(docker --version 2>$null)"
    $hasDocker = $true
} catch {
    Write-Warn "Docker no encontrado (opcional — necesario solo para Jina Reader self-hosted)"
}

if (-not $allGood) {
    Write-Fail "Corrige los errores arriba y vuelve a ejecutar el script."
    exit 1
}

# ─── 2. Clone / Pull repo ──────────────────────────────────────────────────
Write-Step "2/7  Clonando repositorio"

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
Write-Step "3/7  Creando archivo .env"

if (Test-Path ".env") {
    Write-OK ".env ya existe — se mantiene"
} else {
    Copy-Item ".env.example" ".env"
    Write-OK ".env creado desde .env.example"
    Write-Host "`n    ╔══════════════════════════════════════════════════════╗"
    Write-Host "    ║  ABRE .env Y COMPLETA LAS VARIABLES OBLIGATORIAS:  ║"
    Write-Host "    ║                                                    ║"
    Write-Host "    ║  JSEARCH_API_KEY ← RapidAPI key (requerido)       ║"
    Write-Host "    ║  GEMINI_API_KEY  ← Google AI key (requerido)      ║"
    Write-Host "    ║  SMTP_USER      ← tu correo Gmail                 ║"
    Write-Host "    ║  SMTP_PASSWORD  ← App Password de Gmail           ║"
    Write-Host "    ║  GMAIL_RECIPIENT← destino del digest              ║"
    Write-Host "    ║                                                    ║"
    Write-Host "    ║  Luego ejecuta el script run.ps1                  ║"
    Write-Host "    ╚══════════════════════════════════════════════════════╝"
    Write-Host ""
    notepad ".env"
}

# ─── 4. npm install ─────────────────────────────────────────────────────────
Write-Step "4/7  Instalando dependencias Node.js (npm install)"

Invoke-Native {
    npm install --legacy-peer-deps 2>&1
} "npm install falló. Revisa la conexión a internet y vuelve a intentar."
Write-OK "npm install completado"

# ─── 5. pip install ──────────────────────────────────────────────────────────
Write-Step "5/7  Instalando dependencias Python (pip)"

try {
    Invoke-Native {
        pip install -r scrapers/requirements.txt 2>&1
    } "pip install falló. Activa tu virtualenv o revisa la instalación de Python."
    Write-OK "pip install completado"
} catch {
    Write-Fail "pip install falló: $_"
    Write-Warn "Si usas Python virtualenv, actívalo antes de ejecutar este script."
    exit 1
}

# ─── 6. Playwright + Patchright browsers ────────────────────────────────────
Write-Step "6/7  Instalando navegadores (Playwright + Patchright)"

Write-Host "    Instalando Playwright Chromium..."
try {
    Invoke-Native {
        playwright install chromium 2>&1
    } "playwright install chromium falló"
    Write-OK "Playwright Chromium instalado"
} catch {
    Write-Warn "playwright install chromium falló: $_"
}

Write-Host "    Instalando Patchright Chromium..."
try {
    Invoke-Native {
        patchright install chromium 2>&1
    } "patchright install chromium falló"
    Write-OK "Patchright Chromium instalado"
} catch {
    Write-Warn "patchright install chromium falló: $_"
}

# ─── 7. Docker Jina Reader (optional) ───────────────────────────────────────
Write-Step "7/7  Jina Reader (Docker — opcional)"

if ($hasDocker) {
    Write-Host "    ¿Levantar Jina Reader via Docker? (s/n) " -NoNewline
    $response = Read-Host
    if ($response -eq 's') {
        try {
            Invoke-Native {
                docker compose up -d jina-reader 2>&1
            } "docker compose up falló"
            Write-OK "Jina Reader corriendo en http://localhost:3001"
        } catch {
            Write-Warn "docker compose up falló: $_"
        }
    } else {
        Write-OK "Jina Reader omitido. Para iniciarlo luego: docker compose up -d jina-reader"
    }
} else {
    Write-OK "Docker no disponible — Jina Reader saltado (opcional, no crítico)"
}

# ─── Finish ──────────────────────────────────────────────────────────────────
Write-Step "✅  Instalación completada"
Write-Host "`
    Para ejecutar el pipeline:`
        .\scripts\run.ps1`
    O directamente:`
        npx tsx scripts/run-profile-pipeline.ts ruta/al/cv.pdf`
    O el dashboard:`
        npm run dev`
`

Pop-Location
