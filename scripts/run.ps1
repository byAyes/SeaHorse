<#
.SYNOPSIS
    SeaHorse — Runner automatizado (pipeline completo / básico / dashboard)
.DESCRIPTION
    Ejecuta el pipeline de scraping + matching + email, o inicia el dashboard.
    Valida .env, detecta CVs en data/, y pregunta antes de enviar.
    Solo copia y pega en PowerShell.
.PARAMETER CvPath
    Ruta al archivo CV/PDF para extracción de perfil.
    Si se omite, busca en data/ o pregunta por la ruta.
.EXAMPLE
    .\scripts\run.ps1
    .\scripts\run.ps1 -CvPath "C:\Users\Juan\Downloads\CV.pdf"
    .\scripts\run.ps1 -Dashboard
.PARAMETER Dashboard
    Inicia el servidor de desarrollo Next.js en lugar del pipeline.
.PARAMETER Basic
    Ejecuta el pipeline básico (sin extracción de perfil desde CV).
#>

param(
    [string]$CvPath = "",
    [switch]$Dashboard,
    [switch]$Basic
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
Write-Step "1/4  Verificando entorno"

# Node
try {
    $nodeVer = node --version 2>$null
    Write-OK "Node.js $nodeVer"
} catch {
    Write-Fail "Node.js no encontrado. Ejecuta primero setup.ps1"
    exit 1
}

# Carpeta del proyecto
# Si el script está en scripts/, el project root es el padre.
# Si está suelto (descarga standalone), el project root es su mismo directorio.
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptDirName = Split-Path -Leaf $ScriptRoot
if ($ScriptDirName -eq 'scripts') {
    $ProjectRoot = Resolve-Path "$ScriptRoot\.."
} else {
    $ProjectRoot = $ScriptRoot
}
Push-Location $ProjectRoot
Write-OK "Directorio: $ProjectRoot"

# ─── 2. Validar .env ────────────────────────────────────────────────────────
Write-Step "2/4  Validando configuración (.env)"

if (-not (Test-Path ".env")) {
    Write-Fail ".env no encontrado. Ejecuta setup.ps1 primero."
    Pop-Location
    exit 1
}

Write-OK ".env existe"

# Cargar variables mínimas
$missingVars = @()

$jsKey = Get-EnvVar "JSEARCH_API_KEY"
if (-not $jsKey) { $missingVars += "JSEARCH_API_KEY" }

$gmKey = Get-EnvVar "GEMINI_API_KEY"
if (-not $gmKey) { $missingVars += "GEMINI_API_KEY" }

$recipient = Get-EnvVar "GMAIL_RECIPIENT"
if (-not $recipient) { $missingVars += "GMAIL_RECIPIENT" }

if ($missingVars.Count -gt 0) {
    Write-Warn "Variables pendientes: $($missingVars -join ', ')"
    Write-Host "    Edita .env y completa los valores faltantes."
    Write-Host "    Luego vuelve a ejecutar este script.`n"
    $editNow = Read-Host "    ¿Abrir .env ahora? (s/n)"
    if ($editNow -eq 's') {
        notepad ".env"
    }
    Pop-Location
    exit 1
} else {
    Write-OK "Variables esenciales configuradas"
}

# ─── 3. Elegir modo de ejecución ────────────────────────────────────────────
Write-Step "3/4  Seleccionando modo"

if ($Dashboard) {
    Write-OK "Modo Dashboard seleccionado"
} elseif ($Basic) {
    Write-OK "Modo Pipeline Básico seleccionado"
    Write-Info "Se ejecutará: scrape → match → email (sin perfil extraído de CV)"
} else {
    # Buscar CVs automáticamente
    $candidates = @()
    if (Test-Path "data") {
        $candidates = Get-ChildItem "data" -Filter "*.pdf" -ErrorAction SilentlyContinue
    }

    Write-Host "`n    ¿Qué quieres hacer?`n"
    Write-Host "    [1] Pipeline completo (extraer perfil desde CV → scrape → match → email)"
    Write-Host "    [2] Pipeline básico  (scrape → match → email, sin extracción de CV)"
    Write-Host "    [3] Dashboard UI     (servidor de desarrollo Next.js)"
    Write-Host "    [4] Solo Jina Reader (test headless Chrome fallback)"
    Write-Host "`n    Elige [1-4]: " -NoNewline
    $mode = Read-Host

    if ($mode -eq '4') {
        # Jina Reader standalone
        Write-Host "    Fuente (linkedin/indeed/computrabajo/glassdoor): " -NoNewline
        $jrSource = Read-Host
        if ($jrSource -eq '') { $jrSource = 'linkedin' }
        Write-Host "    Query (ej: software engineer): " -NoNewline
        $jrQuery = Read-Host
        if ($jrQuery -eq '') { $jrQuery = 'software engineer' }
        Write-Host "    Máx jobs (ej: 10): " -NoNewline
        $jrMax = Read-Host
        if ($jrMax -eq '') { $jrMax = '10' }

        Write-Step "4/4  Ejecutando Jina Reader standalone"

        $jinaUrl = Get-EnvVar "JINA_READER_BASE_URL"
        if (-not $jinaUrl) { $jinaUrl = "https://r.jina.ai" }
        $env:JINA_READER_BASE_URL = $jinaUrl
        Write-Info "JINA_READER_BASE_URL=$jinaUrl"
        Write-Info "Comando: npx tsx src/scrapers/strategies/jinaReader.ts $jrSource `"$jrQuery`" $jrMax"
        Write-Host "`n"

        try {
            Invoke-Native {
                npx tsx src/scrapers/strategies/jinaReader.ts $jrSource $jrQuery $jrMax 2>&1
            } "Jina Reader falló"
        } catch {
            Write-Fail "Error: $_"
        }

        Pop-Location
        exit 0
    }

    if ($mode -eq '2') {
        $Basic = $true
    } elseif ($mode -eq '3') {
        $Dashboard = $true
    } else {
        # Pipeline completo — buscar CV
        if ($CvPath -eq '' -and $candidates.Count -gt 0) {
            Write-Host "`n    CVs encontrados en data/:`n"
            for ($i=0; $i -lt $candidates.Count; $i++) {
                Write-Host "    [$($i+1)] $($candidates[$i].Name)"
            }
            Write-Host "    [$($candidates.Count+1)] Especificar otra ruta"
            Write-Host "    [$($candidates.Count+2)] Cancelar`n"
            Write-Host "    Elige [1-$($candidates.Count+2)]: " -NoNewline
            $cvChoice = Read-Host
            if ($cvChoice -le $candidates.Count) {
                $CvPath = $candidates[$cvChoice-1].FullName
            } elseif ($cvChoice -eq $candidates.Count + 1) {
                Write-Host "    Ruta del CV: " -NoNewline
                $CvPath = Read-Host
            } else {
                Write-Host "    Cancelado."
                Pop-Location
                exit 0
            }
        } elseif ($CvPath -eq '') {
            Write-Host "    Ruta del CV/PDF (o Enter para cancelar): " -NoNewline
            $CvPath = Read-Host
            if ($CvPath -eq '') {
                Write-Host "    Cancelado."
                Pop-Location
                exit 0
            }
        }
    }
}

# ─── 4. Ejecutar ────────────────────────────────────────────────────────────
if ($Dashboard) {
    Write-Step "4/4  Iniciando servidor de desarrollo Next.js"
    Write-Info "    Dashboard: http://localhost:3000"
    Write-Info "    Healthcheck: http://localhost:3000/api/health"
    Write-Info "    Presiona Ctrl+C para detener`n"
    try {
        Invoke-Native { npm run dev 2>&1 } "npm run dev falló"
    } catch {
        Write-Fail "Error: $_"
    }
} elseif ($Basic) {
    Write-Step "4/4  Ejecutando pipeline básico (scrape → match → email)`n"
    try {
        Invoke-Native { npm run automate 2>&1 } "Pipeline básico falló"
    } catch {
        Write-Fail "Error: $_"
    }
} else {
    Write-Step "4/4  Ejecutando pipeline completo"
    Write-Info "    CV: $CvPath"
    Write-Info "    Esto toma ~60-90 segundos...`n"
    try {
        Invoke-Native { npx tsx scripts/run-profile-pipeline.ts $CvPath 2>&1 } "Pipeline completo falló"
    } catch {
        Write-Fail "Error: $_"
    }
}

Pop-Location
