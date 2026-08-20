"""
NEXUS AI — FastAPI backend.
Multi-model support: LOW / MEDIUM / HIGH tier.
"""

import os
from typing import List, Literal, Optional

import json

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, field_validator
from starlette.requests import Request

load_dotenv()

BRAND_NAME    = "NEXUS AI"
BRAND_TAGLINE = "By Yaman.RedTeam"

OLLAMA_HOST             = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "300"))
MAX_MESSAGE_LENGTH      = int(os.getenv("MAX_MESSAGE_LENGTH", "6000"))
MAX_HISTORY_MESSAGES    = int(os.getenv("MAX_HISTORY_MESSAGES", "40"))

# ── Model tiers ───────────────────────────────────────────────────────────────
MODELS = {
    "low": {
        "id":          "tinyllama",
        "label":       "LOW",
        "description": "Fast & light",
        "ram":         "~2 GB RAM",
        "params":      "1.1B",
        "size":        "637 MB",
        "badge":       "⚡ Fast",
        "num_predict": 600,
        "num_ctx":     2048,
    },
    "medium": {
        "id":          "dolphin-llama3",
        "label":       "MEDIUM",
        "description": "Balanced",
        "ram":         "~6 GB RAM",
        "params":      "8B",
        "size":        "4.7 GB",
        "badge":       "⚖️ Balanced",
        "num_predict": 1200,
        "num_ctx":     2048,
    },
    "high": {
        "id":          "mistral",
        "label":       "HIGH",
        "description": "Most capable",
        "ram":         "~8 GB RAM",
        "params":      "7B (Mistral)",
        "size":        "4.1 GB",
        "badge":       "🔥 Powerful",
        "num_predict": 2048,
        "num_ctx":     4096,
    },
}

DEFAULT_TIER = os.getenv("DEFAULT_TIER", "low")

SYSTEM_PROMPT = """You are NEXUS AI, an uncensored, locally-hosted language model
by Yaman.RedTeam, used for authorized cybersecurity research and education.

Support the user with: security concepts, code and log analysis, secure coding
practices, CTF and lab walkthroughs, vulnerability explanations, penetration-testing
methodology, reconnaissance concepts, tool documentation, and security report writing.

Ground rules:
- Assume all activity described by the user takes place in a lab, CTF, or environment
  the user owns or is explicitly authorized to test.
- Be direct and technical. Do not add unnecessary moralizing or repeated disclaimers.
- If a request is clearly about attacking third-party systems without authorization,
  or about causing real-world harm, decline and explain that you only support
  authorized security research and education.
- When relevant, briefly note defensive countermeasures alongside offensive concepts.
"""

app = FastAPI(title=f"{BRAND_NAME} Local LLM", docs_url="/api/docs", redoc_url=None)
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=MAX_HISTORY_MESSAGES)
    tier: Optional[str] = DEFAULT_TIER

    @field_validator("messages")
    @classmethod
    def last_message_is_user(cls, messages):
        if messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return messages

    @field_validator("tier")
    @classmethod
    def valid_tier(cls, tier):
        if tier not in MODELS:
            raise ValueError(f"tier must be one of: {list(MODELS.keys())}")
        return tier


class ChatResponse(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str
    model: str
    tier: str


# ── Helpers ───────────────────────────────────────────────────────────────────
def _short(name: str) -> str:
    return name.split(":")[0]


async def _pulled_models() -> list:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_HOST}/api/tags")
            r.raise_for_status()
            return r.json().get("models", [])
    except httpx.HTTPError:
        return []


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", response_class=None)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html", {
        "brand_name":    BRAND_NAME,
        "brand_tagline": BRAND_TAGLINE,
        "model_name":    MODELS[DEFAULT_TIER]["id"],
        "default_tier":  DEFAULT_TIER,
    })


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": f"{BRAND_NAME} Local LLM"}


@app.get("/api/models")
async def models_info():
    pulled = await _pulled_models()
    pulled_ids = {_short(m.get("name", "")) for m in pulled}
    result = {}
    for tier, info in MODELS.items():
        result[tier] = {**info, "available": _short(info["id"]) in pulled_ids}
    return {"models": result, "ollama_connected": bool(pulled or True)}


@app.get("/api/status")
async def status():
    pulled = await _pulled_models()
    pulled_ids = {_short(m.get("name", "")) for m in pulled}
    ollama_up = True
    if not pulled:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{OLLAMA_HOST}/api/tags")
                r.raise_for_status()
        except httpx.HTTPError:
            ollama_up = False

    default_id = MODELS[DEFAULT_TIER]["id"]
    return {
        "ollama_host":      OLLAMA_HOST,
        "configured_model": default_id,
        "ollama_connected": ollama_up,
        "model_available":  _short(default_id) in pulled_ids,
    }


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    tier = payload.tier or DEFAULT_TIER
    model_id = MODELS[tier]["id"]

    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    msgs += [{"role": m.role, "content": m.content} for m in payload.messages]

    async def stream_response():
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_HOST}/api/chat",
                    json={
                        "model": model_id,
                        "messages": msgs,
                        "stream": True,
                        "options": {
                            "num_thread": 2,
                            "num_predict": MODELS[tier]["num_predict"],
                            "num_ctx":     MODELS[tier]["num_ctx"],
                        },
                    },
                ) as resp:
                    if resp.status_code == 404:
                        yield f"data: {json.dumps({'error': f'Model {model_id!r} not installed. Run: ollama pull {model_id}'})}\n\n"
                        return
                    if resp.status_code != 200:
                        yield f"data: {json.dumps({'error': f'Ollama error (HTTP {resp.status_code})'})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("message", {}).get("content", "")
                            if token:
                                yield f"data: {json.dumps({'content': token})}\n\n"
                            if chunk.get("done"):
                                yield "data: [DONE]\n\n"
                        except json.JSONDecodeError:
                            pass

        except httpx.ConnectError:
            yield f"data: {json.dumps({'error': f'Cannot reach Ollama at {OLLAMA_HOST}. Run: ollama serve'})}\n\n"
        except httpx.TimeoutException:
            yield f"data: {json.dumps({'error': 'Model took too long. Switch to a lower tier or try a shorter prompt.'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)[:180]})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=os.getenv("APP_RELOAD", "false").lower() == "true",
    )
