# YamanRedTeam — Uncensored Local LLM for Cybersecurity Research

A privacy-focused, locally-hosted AI assistant for cybersecurity learners and
researchers, built on **Python, FastAPI, and Ollama**. The model runs
entirely on your own machine — prompts and responses never touch a
third-party API.

![status](https://img.shields.io/badge/status-active-brightgreen)
![python](https://img.shields.io/badge/python-3.10%2B-blue)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What this is

YamanRedTeam Local LLM wraps an uncensored/open local language model
(served through [Ollama](https://ollama.com), by default a Dolphin-family
model) in a clean FastAPI + web chat interface, aimed at:

- Explaining cybersecurity concepts
- Reading security documentation
- Reviewing code for security issues
- Analyzing logs
- Secure coding guidance
- CTF and lab learning support
- Explaining vulnerability classes
- Penetration-testing **methodology**, for authorized environments
- Reconnaissance **concepts**
- Documenting security tools
- Explaining security findings
- Writing security reports

This project is a learning/demo tool for **authorized** security research,
CTFs, and lab environments — not a tool for attacking systems you don't own
or have explicit permission to test.

## About the "uncensored" model

This project demonstrates running an uncensored/open local language model
through Ollama. Such models may provide fewer built-in refusals than
heavily safety-aligned commercial assistants, which is useful for direct,
jargon-free technical answers during security research. "Uncensored" does
**not** mean unlimited or all-knowing — it is still a language model that
can be wrong, and it should be used responsibly, only for authorized
security research, education, CTFs, and controlled lab environments.

## Architecture

```
User → YamanRedTeam Web UI → FastAPI Backend → Ollama API → Local LLM
                                                      │
User ← YamanRedTeam Web UI ← FastAPI Backend ←────────┘
```

See [docs/Architecture.md](docs/Architecture.md) for the full component
breakdown, and [docs/Local_LLM_Setup_YamanRedTeam.pdf](docs/Local_LLM_Setup_YamanRedTeam.pdf)
for a complete setup and concepts guide.

## Project structure

```
Local-LLM-YamanRedTeam/
│
├── app.py                     # FastAPI backend
├── requirements.txt
├── run.sh                     # Starts Ollama (if needed) + the web app
├── README.md
├── .gitignore
├── LICENSE
├── .env.example
│
├── templates/
│   └── index.html             # Jinja2 chat UI
│
├── static/
│   ├── css/style.css          # Dark cyber theme
│   ├── js/app.js              # Chat logic, safe DOM rendering
│   └── assets/yamanredteam-logo.svg
│
├── docs/
│   ├── Architecture.md
│   └── Local_LLM_Setup_YamanRedTeam.pdf
│
└── screenshots/                # UI screenshots for the README / video
```

## Requirements

- Linux (tested on Kali Linux) or macOS/WSL2
- Python 3.10+
- [Ollama](https://ollama.com) installed and runnable
- ~5–8 GB free disk space for a Dolphin-family model

## Setup (Linux / Kali Linux)

```bash
# 1. Install Ollama (skip if already installed)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Clone your repo
git clone https://github.com/<your-username>/Local-LLM-YamanRedTeam.git
cd Local-LLM-YamanRedTeam

# 3. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 4. Install Python dependencies
pip install -r requirements.txt

# 5. Copy the example environment file
cp .env.example .env
# edit .env if you want a different model, host, or port

# 6. Pull the local model
ollama pull dolphin-llama3
```

## Running the app

Option A — the helper script (starts Ollama if it isn't running, then the web app):

```bash
./run.sh
```

Option B — manual:

```bash
ollama serve &          # if not already running
source venv/bin/activate
uvicorn app:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000**.

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable                  | Default                     | Purpose                                   |
|----------------------------|------------------------------|--------------------------------------------|
| `OLLAMA_MODEL`             | `dolphin-llama3`             | Model tag Ollama should run                |
| `OLLAMA_HOST`               | `http://localhost:11434`     | Ollama API base URL                        |
| `APP_HOST` / `APP_PORT`    | `0.0.0.0` / `8000`           | FastAPI bind address                       |
| `REQUEST_TIMEOUT_SECONDS`  | `120`                        | Timeout for a single Ollama generation      |
| `MAX_MESSAGE_LENGTH`       | `6000`                       | Max characters per chat message             |
| `MAX_HISTORY_MESSAGES`     | `40`                         | Max messages kept in one conversation       |

The model is **never hardcoded** in the application code — swap in any
compatible Ollama model (`dolphin-mixtral`, `dolphin-phi`, `llama3`,
`mistral`, etc.) by changing `OLLAMA_MODEL` and pulling it with
`ollama pull <model>`.

## API

- `GET /` — chat UI
- `GET /api/health` — liveness check for the web service
- `GET /api/status` — Ollama connectivity + model-availability check
- `POST /api/chat` — body `{ "messages": [{ "role": "user", "content": "..." }] }`,
  returns `{ "role": "assistant", "content": "...", "model": "..." }`

## Troubleshooting

- **"Ollama offline" status / 503 from `/api/chat`** — make sure
  `ollama serve` is running and reachable at `OLLAMA_HOST`.
- **"Model not pulled" status** — run `ollama pull <OLLAMA_MODEL>`.
- **Slow first response** — the first request after starting Ollama loads
  model weights into memory; later requests are faster.
- **Port already in use** — change `APP_PORT` in `.env`.

## Responsible use

This project is intended for:

- Systems and networks **you own**, or
- Systems and networks you have **explicit written authorization** to test
  (CTFs, labs, and scoped engagements)

Do not use this project, or any content it generates, against systems you
do not own or are not authorized to test. You are responsible for complying
with all applicable laws and the terms of any engagement you work under.

## License

MIT — see [LICENSE](LICENSE).

---

Built independently by **YamanRedTeam**.
