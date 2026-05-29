#!/usr/bin/env bash
# =============================================================================
# SeaHorse — Dev server manager
# Kills any existing Next.js dev server on ports 3000/3001 before starting
# a fresh instance. Prevents "Internal Server Error" from stale zombie servers.
#
# Uso:
#   ./scripts/dev.sh
#   ./scripts/dev.sh --port 3000
# =============================================================================
set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────
PORT="${1:-3000}"

# ─── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[2;37m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "    ${GRAY}$1${NC}"; }

# ─── Find project root ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_BASENAME="$(basename "$SCRIPT_DIR")"
if [[ "$SCRIPT_BASENAME" == "scripts" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi
cd "$PROJECT_ROOT"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║    SeaHorse — Dev Server Manager         ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ─── 1. Find and kill existing Next.js processes ─────────────────────────────
echo "  ─── Step 1: Cleaning up old servers ───"

KILLED_ANY=false

# Method 1: Kill by port using fuser (Linux)
if command -v fuser &>/dev/null; then
  for p in 3000 3001; do
    if fuser "$p/tcp" &>/dev/null 2>&1; then
      warn "Port $p — killing process..."
      fuser -k "$p/tcp" 2>/dev/null || true
      ok "Port $p freed"
      KILLED_ANY=true
    fi
  done
fi

# Method 2: Kill by port using lsof (macOS / Linux)
if command -v lsof &>/dev/null; then
  for p in 3000 3001; do
    PID=$(lsof -ti :"$p" 2>/dev/null || true)
    if [[ -n "$PID" ]]; then
      warn "Port $p (PID $PID) — killing..."
      kill -9 "$PID" 2>/dev/null || true
      ok "Port $p freed"
      KILLED_ANY=true
    fi
  done
fi

#Method 3: Kill Next.js / node processes by name (fallback)
  if command -v taskkill &>/dev/null; then
    # Windows (Git Bash / Cygwin) — use taskkill
    # Only kill node processes whose window title contains 'next' or 'dev'
    # to avoid killing unrelated Node.js apps (API servers, build watchers, etc.)
    NEXT_WINS=$(tasklist //V //FI "IMAGENAME eq node.exe" //FO CSV //NH 2>/dev/null | grep -iE "next|dev" || true)
    if [[ -n "$NEXT_WINS" ]]; then
      warn "Killing Next.js node.exe processes ..."
      taskkill //F //FI "IMAGENAME eq node.exe" //FI "WINDOWTITLE eq *next*" 2>/dev/null || true
      taskkill //F //FI "IMAGENAME eq node.exe" //FI "WINDOWTITLE eq *dev*" 2>/dev/null || true
      ok "Next.js node.exe processes killed"
      KILLED_ANY=true
    fi
  fi

# Method 4: kill-port via npx (universal fallback)
if ! command -v lsof &>/dev/null && ! command -v fuser &>/dev/null; then
  warn "No lsof or fuser — using npx kill-port..."
  npx --yes kill-port 3000 3001 2>/dev/null && ok "Ports freed via kill-port" && KILLED_ANY=true || true
fi

# Method 5: pkill by name (Linux/macOS)
if command -v pkill &>/dev/null; then
  # Check if there's a running next dev before killing
  if pgrep -f "next dev" &>/dev/null; then
    warn "Killing next dev processes..."
    pkill -f "next dev" 2>/dev/null || true
    ok "next dev processes killed"
    KILLED_ANY=true
  fi
fi

if [[ "$KILLED_ANY" == false ]]; then
  ok "No stale servers found — clean slate"
fi

# Wait briefly for ports to release
sleep 2

# ─── Verify ports are free ───────────────────────────────────────────────────
echo ""
echo "  ─── Step 2: Verifying ports ───"

PORTS_CLEAR=true
for p in 3000 3001; do
  if command -v lsof &>/dev/null; then
    if lsof -ti :"$p" &>/dev/null; then
      fail "Port $p still in use — try: taskkill /F /PID $(lsof -ti :$p)"
      PORTS_CLEAR=false
    else
      ok "Port $p is free"
    fi
  elif command -v fuser &>/dev/null; then
    if fuser "$p/tcp" &>/dev/null 2>&1; then
      fail "Port $p still in use"
      PORTS_CLEAR=false
    else
      ok "Port $p is free"
    fi
  else
    info "Port $p — skipping verification (no lsof/fuser)"
  fi
done

if [[ "$PORTS_CLEAR" == false ]]; then
  echo ""
  fail "Cannot start dev server — ports still occupied. Run:"
  info "npx kill-port 3000 3001"
  exit 1
fi

# ─── Start fresh dev server ──────────────────────────────────────────────────
echo ""
echo "  ─── Step 3: Starting Next.js dev server ───"
info "Port: $PORT"
info "URL:  http://localhost:$PORT"
info "Press Ctrl+C to stop"
echo ""

# Export port for next
export PORT="$PORT"

if command -v npx &>/dev/null; then
  npx next dev --port "$PORT"
else
  npm run dev -- --port "$PORT"
fi
