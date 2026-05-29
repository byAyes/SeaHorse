#!/usr/bin/env bash
# =============================================================================
# SeaHorse — Runner automatizado (Linux / macOS)
# Por defecto inicia el dashboard web (Next.js).
# También puede ejecutar el pipeline de scraping + matching + email directamente.
#
# La configuración de API keys y perfil se realiza desde el wizard web
# en http://localhost:3000/setup después de iniciar el dashboard.
#
# Uso:
#   ./scripts/run.sh                    # Inicia el dashboard (default)
#   ./scripts/run.sh --cv ruta/cv.pdf   # Pipeline completo
#   ./scripts/run.sh --basic            # Pipeline básico (sin CV)
#   ./scripts/run.sh --jina-reader      # Test Jina Reader standalone
#   ./scripts/run.sh --help
# =============================================================================
set -euo pipefail

# ─── Argumentos ──────────────────────────────────────────────────────────────
CV_PATH=""
MODE="dashboard"  # default mode

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cv)   CV_PATH="$2"; MODE="full"; shift 2 ;;
        --basic)     MODE="basic"; shift ;;
        --jina-reader) MODE="jina"; shift ;;
        --help|-h)
            echo "Uso: $0 [OPCIÓN]"
            echo "  (sin args)     Inicia el dashboard web (Next.js)"
            echo "  --cv RUTA      Pipeline completo con extracción de CV"
            echo "  --basic        Pipeline básico (scrape → match → email, sin CV)"
            echo "  --jina-reader  Test Jina Reader standalone"
            echo ""
            echo "  Las API keys se configuran desde el wizard en http://localhost:3000/setup"
            exit 0 ;;
        *) echo "❌ Argumento desconocido: $1 (usa --help)"; exit 1 ;;
    esac
done

# ─── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[2;37m'
NC='\033[0m'

step()   { echo -e "\n━━━ $1 ━━━"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()   { echo -e "  ${RED}✗${NC} $1"; }
info()   { echo -e "    ${GRAY}$1${NC}"; }

# ─── Helper: read non-commented env var from .env ────────────────────────────
get_env_var() {
    local name="$1"
    local line value
    while IFS= read -r line; do
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        [[ "$line" =~ ^# ]] && continue
        [[ -z "$line" ]] && continue
        if [[ "$line" =~ ^"$name"=(.+) ]]; then
            value="${BASH_REMATCH[1]}"
            if [[ "$value" =~ your_.*_here|your_email ]]; then
                echo ""; return 0
            fi
            echo "$value"; return 0
        fi
    done < ".env" 2>/dev/null
    echo ""
}

# ─── 1. Prereqs check ───────────────────────────────────────────────────────
step "1/3  Verificando entorno"

if ! command -v node &>/dev/null; then
    fail "Node.js no encontrado. Ejecuta primero: ./scripts/setup.sh"
    exit 1
fi
ok "Node.js $(node --version)"

# Carpeta del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_BASENAME="$(basename "$SCRIPT_DIR")"
if [[ "$SCRIPT_BASENAME" == "scripts" ]]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    PROJECT_ROOT="$SCRIPT_DIR"
fi
cd "$PROJECT_ROOT"
ok "Directorio: $PROJECT_ROOT"

# ─── 2. Verificar .env ──────────────────────────────────────────────────────
step "2/3  Verificando configuración"

if [[ ! -f ".env" ]]; then
    warn ".env no encontrado — las API keys se configuran desde el wizard web"
    info "      1. Inicia el dashboard: npm run dev"
    info "      2. Abre http://localhost:3000/setup"
    info "      3. Sigue el wizard para configurar tus keys"
    echo ""
elif [[ -z "$(get_env_var "GEMINI_API_KEY")" && -z "$(get_env_var "OPENROUTER_API_KEY")" && -z "$(get_env_var "NVIDIA_NIM_API_KEY")" ]]; then
    warn "No hay AI keys configuradas en .env"
    info "    Configúralas desde el wizard web en http://localhost:3000/setup"
    info "    O edita .env directamente con tus keys."
    echo ""
else
    ok "Configuración lista"
fi

# ─── 3. Ejecutar ────────────────────────────────────────────────────────────
if [[ "$MODE" == "dashboard" ]]; then
    step "3/3  Iniciando servidor de desarrollo Next.js"
    info "    Dashboard: http://localhost:3000"
    info "    Setup:     http://localhost:3000/setup"
    info "    Presiona Ctrl+C para detener"
    echo ""
    npm run dev

elif [[ "$MODE" == "full" ]]; then
    step "3/3  Ejecutando pipeline completo"
    info "    CV: $CV_PATH"
    info "    Esto toma ~60-90 segundos..."
    echo ""
    npx tsx scripts/run-profile-pipeline.ts "$CV_PATH"

elif [[ "$MODE" == "basic" ]]; then
    step "3/3  Ejecutando pipeline básico (scrape → match → email)"
    echo ""
    npm run automate

elif [[ "$MODE" == "jina" ]]; then
    step "3/3  Ejecutando Jina Reader standalone"
    echo "    Uso: npx tsx src/scrapers/strategies/jinaReader.ts <fuente> \"<query>\" <max>"
    echo ""
    read -rp "    Fuente (linkedin/indeed/computrabajo/glassdoor): " JR_SOURCE || true
    JR_SOURCE="${JR_SOURCE:-linkedin}"
    read -rp "    Query (ej: software engineer): " JR_QUERY || true
    JR_QUERY="${JR_QUERY:-software engineer}"
    read -rp "    Máx jobs (ej: 10): " JR_MAX || true
    JR_MAX="${JR_MAX:-10}"
    echo ""
    npx tsx src/scrapers/strategies/jinaReader.ts "$JR_SOURCE" "$JR_QUERY" "$JR_MAX"
fi
