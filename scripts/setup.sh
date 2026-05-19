#!/usr/bin/env bash
# =============================================================================
# SeaHorse — Setup automatizado (Linux / macOS)
# Clona el repo, instala dependencias (npm + pip), instala navegadores
# Playwright/Patchright, y crea .env desde .env.example.
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
step "1/7  Verificando prerrequisitos"

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
    PY_NUM=$(echo "$PY_VER" | sed -n 's/Python \([0-9]\+\.[0-9]\+\).*/\1/p')
    IFS='.' read -ra PY_VER_PARTS <<< "$PY_NUM"
    if [ "${PY_VER_PARTS[0]:-0}" -gt 3 ] || ([ "${PY_VER_PARTS[0]:-0}" -eq 3 ] && [ "${PY_VER_PARTS[1]:-0}" -ge 12 ]); then
        ok "Python3 $PY_VER"
    else
        warn "Python $PY_VER — se requiere >= 3.12. Descarga: https://python.org"
        ALL_GOOD=false
    fi
elif command -v python &>/dev/null; then
    PY_VER=$(python --version 2>&1)
    PY_NUM=$(echo "$PY_VER" | sed -n 's/Python \([0-9]\+\.[0-9]\+\).*/\1/p')
    IFS='.' read -ra PY_VER_PARTS <<< "$PY_NUM"
    if [ "${PY_VER_PARTS[0]:-0}" -gt 3 ] || ([ "${PY_VER_PARTS[0]:-0}" -eq 3 ] && [ "${PY_VER_PARTS[1]:-0}" -ge 12 ]); then
        ok "Python $PY_VER"
    else
        warn "Python $PY_VER — se requiere >= 3.12. Descarga: https://python.org"
        ALL_GOOD=false
    fi
else
    fail "Python no encontrado. Descarga: https://python.org"
    ALL_GOOD=false
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
HAS_DOCKER=false
if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker --version)
    ok "Docker $DOCKER_VER"
    HAS_DOCKER=true
else
    warn "Docker no encontrado (opcional — necesario solo para Jina Reader self-hosted)"
fi

if [ "$ALL_GOOD" = false ]; then
    fail "Corrige los errores arriba y vuelve a ejecutar el script."
    exit 1
fi

# ─── 2. Clone / Pull repo ───────────────────────────────────────────────────
step "2/7  Clonando repositorio"

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
step "3/7  Creando archivo .env"

if [ -f ".env" ]; then
    ok ".env ya existe — se mantiene"
else
    cp ".env.example" ".env"
    ok ".env creado desde .env.example"
    echo ""
    echo "    ╔══════════════════════════════════════════════════════╗"
    echo "    ║  ABRE .env Y COMPLETA LAS VARIABLES OBLIGATORIAS:  ║"
    echo "    ║                                                    ║"
    echo "    ║  JSEARCH_API_KEY ← RapidAPI key (requerido)       ║"
    echo "    ║  GEMINI_API_KEY  ← Google AI key (requerido)      ║"
    echo "    ║  SMTP_USER      ← tu correo Gmail                 ║"
    echo "    ║  SMTP_PASSWORD  ← App Password de Gmail           ║"
    echo "    ║  GMAIL_RECIPIENT← destino del digest              ║"
    echo "    ║                                                    ║"
    echo "    ║  Luego ejecuta: ./scripts/run.sh                  ║"
    echo "    ╚══════════════════════════════════════════════════════╝"
    echo ""
    # Open editor
    if command -v nano &>/dev/null; then
        echo "    Abriendo nano para editar .env..."
        nano ".env"
    elif command -v vim &>/dev/null; then
        echo "    Abriendo vim para editar .env..."
        vim ".env"
    elif command -v code &>/dev/null; then
        echo "    Abriendo VS Code para editar .env..."
        code ".env"
    else
        echo "    Edita .env con tu editor favorito: nano .env"
    fi
fi

# ─── 4. npm install ──────────────────────────────────────────────────────────
step "4/7  Instalando dependencias Node.js (npm install)"

if run_cmd "npm install --legacy-peer-deps" "npm install falló. Revisa la conexión a internet y vuelve a intentar."; then
    ok "npm install completado"
else
    exit 1
fi

# ─── 5. pip install ──────────────────────────────────────────────────────────
step "5/7  Instalando dependencias Python (pip)"

# Try python3 -m pip, then python -m pip, then pip3, then pip
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
        warn "Si usas Python virtualenv, actívalo antes de ejecutar este script."
        exit 1
    fi
else
    warn "pip no encontrado. Instala pip para Python 3.12+ y vuelve a intentar."
    info "  En Debian/Ubuntu: sudo apt install python3-pip python3-venv"
    info "  En macOS:         brew install python (ya incluye pip)"
    exit 1
fi

# ─── 6. Playwright + Patchright browsers ─────────────────────────────────────
step "6/7  Instalando navegadores (Playwright + Patchright)"

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

# ─── 7. Docker Jina Reader (optional) ────────────────────────────────────────
step "7/7  Jina Reader (Docker — opcional)"

if [ "$HAS_DOCKER" = true ]; then
    echo ""
    read -rp "    ¿Levantar Jina Reader via Docker? (s/n): " DOCKER_RESPONSE
    if [ "$DOCKER_RESPONSE" = "s" ] || [ "$DOCKER_RESPONSE" = "S" ]; then
        if run_cmd "docker compose up -d jina-reader" "docker compose up falló"; then
            ok "Jina Reader corriendo en http://localhost:3001"
        else
            warn "docker compose up falló"
        fi
    else
        ok "Jina Reader omitido. Para iniciarlo luego: docker compose up -d jina-reader"
    fi
else
    ok "Docker no disponible — Jina Reader saltado (opcional, no crítico)"
fi

# ─── Finish ───────────────────────────────────────────────────────────────────
step "✅  Instalación completada"
echo ""
echo "    Para ejecutar el pipeline:"
echo "        ./scripts/run.sh"
echo "    O directamente:"
echo "        npx tsx scripts/run-profile-pipeline.ts ruta/al/cv.pdf"
echo "    O el dashboard:"
echo "        npm run dev"
echo ""
