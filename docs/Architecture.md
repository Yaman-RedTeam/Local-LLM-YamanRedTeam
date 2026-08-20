# YamanRedTeam Local LLM — Architecture

## Overview

YamanRedTeam Local LLM is a thin, local-first web application that lets a
browser-based chat UI talk to a language model running entirely on the
user's own machine via [Ollama](https://ollama.com). No prompt or response
data is sent to any third-party API.

## Request flow

```
User (browser)
      │
      ▼
YamanRedTeam Web UI        templates/index.html, static/css, static/js
      │  fetch("/api/chat")
      ▼
FastAPI Backend            app.py
      │  httpx POST /api/chat
      ▼
Ollama API                 http://localhost:11434
      │
      ▼
Local LLM (e.g. dolphin-llama3)
      │
      ▼
Ollama API  ──►  FastAPI Backend  ──►  Web UI  ──►  User
```

## Components

### 1. Web UI (`templates/`, `static/`)
A single-page chat interface rendered server-side with Jinja2 and enhanced
with vanilla JavaScript. It:

- Displays the YamanRedTeam brand, the active model name, and live
  Ollama connectivity status (polled every 15 seconds via `/api/status`).
- Offers example-prompt categories for common authorized security-research
  tasks (recon concepts, code analysis, log analysis, CTF/lab help, secure
  coding, vulnerability explanation, report writing, and Linux/security
  tooling documentation).
- Keeps the running conversation client-side and resends the full message
  history with each turn — the backend is stateless.
- Renders model output by walking the text and building DOM nodes
  (`textContent`, `createElement`) instead of using `innerHTML` on
  untrusted content, so model output cannot inject markup into the page.

### 2. FastAPI backend (`app.py`)
A small stateless API layer with four routes:

| Route          | Method | Purpose                                            |
|----------------|--------|-----------------------------------------------------|
| `/`            | GET    | Renders the chat UI                                 |
| `/api/health`  | GET    | Liveness check for the web service itself            |
| `/api/status`  | GET    | Checks Ollama connectivity and model availability     |
| `/api/chat`    | POST   | Forwards a validated conversation to Ollama          |

Responsibilities:

- **Input validation** — Pydantic models cap message length and
  conversation length, and require the final message to come from the
  user, before anything is forwarded to Ollama.
- **System prompt injection** — a fixed system prompt frames the
  assistant's purpose (authorized security research and education) and is
  prepended server-side; it is never sent from the client.
- **Ollama integration** — calls Ollama's native `/api/chat` endpoint with
  `stream: false` and a configurable timeout, and translates Ollama/network
  failures into clean HTTP error responses instead of leaking stack traces.
- **Configuration** — the model name and Ollama host are read from
  environment variables (`OLLAMA_MODEL`, `OLLAMA_HOST`), never hardcoded.

### 3. Ollama runtime
Ollama runs as a local background service (`ollama serve`) and exposes a
REST API on `localhost:11434`. It manages downloading, storing, and running
GGUF-quantized models — including uncensored/open community fine-tunes such
as the Dolphin family — entirely on local hardware (CPU or GPU).

### 4. Local model
The active model is whatever is set in `OLLAMA_MODEL` (default
`dolphin-llama3`). It never leaves the machine: Ollama loads model weights
from local disk and performs inference locally, so prompts and generated
text stay on the user's device.

## Why this shape

- **Stateless backend** — no session storage, no database. The browser
  owns the conversation; the server just validates and proxies it. This
  keeps the app easy to reason about and easy to demo.
- **Environment-driven configuration** — swapping models or pointing at a
  remote Ollama instance on the local network requires no code changes.
- **Defense in depth on rendering** — even though the model is expected to
  return plain text/markdown-ish content, the frontend never trusts it
  enough to use `innerHTML` directly.
