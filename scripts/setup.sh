#!/usr/bin/env bash
# =============================================================================
# SeaHorse — Setup automatizado (Linux / macOS)
# Instala dependencias (npm + pip), instala navegadores Playwright/Patchright,
# y crea .env desde .env.example.
#
# La configuración de API keys y perfil se realiza desde el wizard web
# en http://localhost:3000/setup después de iniciar el dashboard.
#
# Uso:
#   ./scripts/setup.sh
#   ./scripts/setup.sh /ruta/donde/clonar
# =============================================================================
set -euo pipefail

REPO_PATH="${1:-$PWD/SeaHorse}"

# ─── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[2;37m'
NC='\033[0m'

step()   { echo -e "\n━━━ $1 ━━━"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()   { echo -e "  ${RED}✗${NC} $1"; }
info()   { echo -e "    ${GRAY}$1${NC}"; }

# ─── Helper: run command with error message ──────────────────────────────────
run_cmd() {
    local cmd="$1"
    local msg="${2:-Command failed}"
    if ! eval "$cmd" 2>&1; then
        echo -e "  ${RED}✗${NC} $msg"
        return 1
    fi
    return 0
}

# ─── 1. Check Prerequisites ──────────────────────────────────────────────────
step "1/6  Verificando prerrequisitos"

ALL_GOOD=true

# Node.js
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_NUM=$(echo "$NODE_VER" | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_NUM" -ge 20 ]; then
        ok "Node.js $NODE_VER"
    else
        warn "Node.js $NODE_VER — se requiere >= 20.x. Descarga: https://nodejs.org"
        ALL_GOOD=false
    fi
else
    fail "Node.js no encontrado. Descarga: https://nodejs.org"
    ALL_GOOD=false
fi

# Python
if command -v python3 &>/dev/null; then
    PY_VER=$(python3 --version 2>&1)
    ok "Python3 $PY_VER"
elif command -v python &>/dev/null; then
    PY_VER=$(python --version 2>&1)
    ok "Python $PY_VER"
else
    warn "Python no encontrado (opcional — necesario solo para scrapers Python). Descarga: https://python.org"
fi

# Git
if command -v git &>/dev/null; then
    GIT_VER=$(git --version)
    ok "$GIT_VER"
else
    fail "Git no encontrado. Descarga: https://git-scm.com"
    ALL_GOOD=false
fi

# Docker (optional)
if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker --version)
    ok "Docker $DOCKER_VER (opcional — Jina Reader self-hosted)"
else
    info "Docker no encontrado (opcional)"
fi

if [ "$ALL_GOOD" = false ]; then
    fail "Corrige los errores arriba y vuelve a ejecutar el script."
    exit 1
fi

# ─── 2. Clone / Pull repo ───────────────────────────────────────────────────
step "2/6  Clonando repositorio"

if [ -d "$REPO_PATH" ]; then
    ok "Carpeta '$REPO_PATH' ya existe — haciendo git pull..."
    (cd "$REPO_PATH" && run_cmd "git pull --ff-only" "git pull falló") || exit 1
    ok "git pull completado"
else
    echo "    Clonando en: $REPO_PATH"
    run_cmd "git clone https://github.com/byAyes/SeaHorse.git \"$REPO_PATH\"" "git clone falló" || exit 1
    ok "Repo clonado"
fi

cd "$REPO_PATH"

# ─── 3. .env ─────────────────────────────────────────────────────────────────
step "3/6  Creando archivo .env"

if [ -f ".env" ]; then
    ok ".env ya existe — se mantiene"
else
    cp ".env.example" ".env"
    ok ".env creado desde .env.example"
    echo ""
    echo "    ℹ️  Las API keys (Gemini, JSearch, etc.) se configuran desde el"
    echo "    wizard web en http://localhost:3000/setup después de iniciar el dashboard."
    echo "    También puedes editar .env manualmente si lo prefieres."
    echo ""
fi

# ─── 4. npm install ──────────────────────────────────────────────────────────
step "4/6  Instalando dependencias Node.js (npm install)"

if run_cmd "npm install --legacy-peer-deps" "npm install falló. Revisa la conexión a internet y vuelve a intentar."; then
    ok "npm install completado"
else
    exit 1
fi

# ─── 5. pip install (opcional) ────────────────────────────────────────────────
step "5/6  Instalando dependencias Python (pip)"

PIP_CMD=""
if python3 -m pip --version &>/dev/null 2>&1; then
    PIP_CMD="python3 -m pip"
elif python -m pip --version &>/dev/null 2>&1; then
    PIP_CMD="python -m pip"
elif command -v pip3 &>/dev/null; then
    PIP_CMD="pip3"
elif command -v pip &>/dev/null; then
    PIP_CMD="pip"
fi

if [ -n "$PIP_CMD" ]; then
    if run_cmd "$PIP_CMD install -r scrapers/requirements.txt" "pip install falló. Activa tu virtualenv o revisa la instalación de Python."; then
        ok "pip install completado"
    else
        warn "pip install falló — los scrapers Python no estarán disponibles"
    fi
else
    warn "pip no encontrado — los scrapers Python no estarán disponibles (opcional)"
fi

# ─── 6. Playwright + Patchright browsers ─────────────────────────────────────
step "6/6  Instalando navegadores (Playwright + Patchright)"

echo "    Instalando Playwright Chromium..."
if command -v npx &>/dev/null; then
    if run_cmd "npx playwright install chromium" "playwright install chromium falló"; then
        ok "Playwright Chromium instalado"
    else
        warn "playwright install chromium falló (no crítico)"
    fi
else
    if run_cmd "playwright install chromium" "playwright install chromium falló"; then
        ok "Playwright Chromium instalado"
    else
        warn "playwright install chromium falló (no crítico)"
    fi
fi

echo "    Instalando Patchright Chromium..."
if command -v npx &>/dev/null; then
    if run_cmd "npx patchright install chromium" "patchright install chromium falló"; then
        ok "Patchright Chromium instalado"
    else
        warn "patchright install chromium falló (no crítico)"
    fi
else
    if run_cmd "patchright install chromium" "patchright install chromium falló"; then
        ok "Patchright Chromium instalado"
    else
        warn "patchright install chromium falló (no crítico)"
    fi
fi

# ─── Finish ───────────────────────────────────────────────────────────────────
step "✅  Instalación completada"
echo ""
echo "    Para iniciar el dashboard:"
echo "        ./scripts/dev.sh"
echo "        # o: npm run dev"
echo ""
echo "    Luego abre http://localhost:3000/setup para configurar"
echo "    tus API keys y perfil desde el wizard web."
echo ""
echo "    Para ejecutar el pipeline desde terminal:"
echo "        npx tsx scripts/run-profile-pipeline.ts ruta/al/cv.pdf"
echo ""
