#!/usr/bin/env bash
# YamanRedTeam Local LLM — startup script.
# Starts Ollama (if not already running) and launches the FastAPI app.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d "venv" ]; then
    echo "[!] No venv/ found. Create one first:"
    echo "    python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# shellcheck disable=SC1091
source venv/bin/activate

if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

OLLAMA_MODEL="${OLLAMA_MODEL:-dolphin-llama3}"
APP_HOST="${APP_HOST:-0.0.0.0}"
APP_PORT="${APP_PORT:-8000}"

if ! command -v ollama >/dev/null 2>&1; then
    echo "[!] 'ollama' was not found on PATH. Install it first: https://ollama.com/download"
    exit 1
fi

if ! pgrep -x "ollama" > /dev/null; then
    echo "[*] Starting Ollama server..."
    nohup ollama serve > /tmp/yamanredteam-ollama.log 2>&1 &
    sleep 3
fi

if ! ollama list | awk '{print $1}' | cut -d: -f1 | grep -qx "${OLLAMA_MODEL%%:*}"; then
    echo "[!] Model '${OLLAMA_MODEL}' is not pulled yet. Pulling it now..."
    ollama pull "${OLLAMA_MODEL}"
fi

echo "[*] Launching YamanRedTeam Local LLM on http://${APP_HOST}:${APP_PORT}"

# Background mode: ./run.sh -d  (uses screen/nohup)
if [[ "${1:-}" == "-d" ]]; then
    if command -v screen >/dev/null 2>&1; then
        screen -dmS llm-server uvicorn app:app --host "${APP_HOST}" --port "${APP_PORT}"
        echo "[+] Running in screen session 'llm-server'. Reattach: screen -r llm-server"
    else
        nohup uvicorn app:app --host "${APP_HOST}" --port "${APP_PORT}" > /tmp/yamanredteam-app.log 2>&1 &
        echo "[+] Running in background (PID $!). Logs: /tmp/yamanredteam-app.log"
    fi
else
    uvicorn app:app --host "${APP_HOST}" --port "${APP_PORT}"
fi
