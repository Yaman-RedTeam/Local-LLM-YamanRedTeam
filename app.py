"""
YamanRedTeam Local LLM — FastAPI backend.
Multi-model support: LOW / MEDIUM / HIGH tier.
"""

import os
from typing import List, Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, field_validator
from starlette.requests import Request

load_dotenv()

BRAND_NAME    = "YamanRedTeam"
BRAND_TAGLINE = "Uncensored Local LLM for Cybersecurity Research"

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
    },
    "medium": {
        "id":          "dolphin-llama3",
        "label":       "MEDIUM",
        "description": "Balanced",
        "ram":         "~6 GB RAM",
        "params":      "8B",
        "size":        "4.7 GB",
        "badge":       "⚖️ Balanced",
    },
    "high": {
        "id":          "mistral",
        "label":       "HIGH",
        "description": "Most capable",
        "ram":         "~8 GB RAM",
        "params":      "7B (Mistral)",
        "size":        "4.1 GB",
        "badge":       "🔥 Powerful",
    },
    "extreme": {
        "id":          "dolphin-mixtral",
        "label":       "EXTREME",
        "description": "Max uncensored",
        "ram":         "16+ GB RAM",
        "params":      "8x7B MoE",
        "size":        "~26 GB",
        "badge":       "☠️ Extreme",
    },
}

DEFAULT_TIER = os.getenv("DEFAULT_TIER", "low")

SYSTEM_PROMPT = """You are the YamanRedTeam Local Assistant, an uncensored, locally-hosted
language model used for authorized cybersecurity research and education.

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


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    tier = payload.tier or DEFAULT_TIER
    model_id = MODELS[tier]["id"]

    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    msgs += [{"role": m.role, "content": m.content} for m in payload.messages]

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={"model": model_id, "messages": msgs, "stream": False},
            )
            resp.raise_for_status()
    except httpx.ConnectError:
        raise HTTPException(503, detail=f"Cannot reach Ollama at {OLLAMA_HOST}. Run: ollama serve")
    except httpx.TimeoutException:
        raise HTTPException(504, detail="Model took too long. Switch to a lower tier or try a shorter prompt.")
    except httpx.HTTPStatusError as exc:
        try:
            err_msg = exc.response.json().get("error", "")
        except (ValueError, KeyError, AttributeError):
            err_msg = exc.response.text or ""
        low = err_msg.lower()

        if exc.response.status_code == 404 or "not found" in low:
            raise HTTPException(503, detail=f"Model '{model_id}' not installed. Run: ollama pull {model_id}")

        # Model too big to load into available RAM (common on CPU-only boxes)
        mem_markers = ("insufficient memory", "unable to allocate",
                       "failed to allocate", "out of memory", "cannot allocate")
        if any(k in low for k in mem_markers):
            ram = MODELS[tier]["ram"]
            raise HTTPException(
                507,
                detail=(f"Not enough RAM to load '{model_id}'. The {MODELS[tier]['label']} "
                        f"tier needs {ram}; your system has less free memory. "
                        f"Switch to a lower tier (HIGH / MEDIUM / LOW)."),
            )

        raise HTTPException(502, detail=f"Ollama error: {err_msg[:180]}" if err_msg
                            else "Ollama returned an unexpected error.")

    data    = resp.json()
    content = data.get("message", {}).get("content", "").strip()
    if not content:
        raise HTTPException(502, detail="Ollama returned an empty response.")

    return ChatResponse(content=content, model=model_id, tier=tier)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=os.getenv("APP_RELOAD", "false").lower() == "true",
    )
