/* ── Model config (mirrors backend MODELS dict) ──────────── */
const MODELS = {
  low: {
    id: "tinyllama", label: "LOW", icon: "⚡",
    params: "1.1B", size: "637 MB", ram: "~2 GB RAM", badge: "⚡ Fast"
  },
  medium: {
    id: "dolphin-llama3", label: "MEDIUM", icon: "⚖️",
    params: "8B", size: "4.7 GB", ram: "~6 GB RAM", badge: "⚖️ Balanced"
  },
  high: {
    id: "mistral", label: "HIGH", icon: "🔥",
    params: "7B (Mistral)", size: "4.1 GB", ram: "~8 GB RAM", badge: "🔥 Powerful"
  },
  extreme: {
    id: "dolphin-mixtral", label: "EXTREME", icon: "☠️",
    params: "8x7B MoE", size: "~26 GB", ram: "16+ GB RAM", badge: "☠️ Extreme"
  }
};

const CATEGORIES = [
  { icon: "🛡️", label: "Security Research", hint: "Recon, scanning, labs",
    prompt: "Explain how TCP SYN scanning works and what it looks like from a defender's point of view, for use in my authorized home lab." },
  { icon: "🧩", label: "Code Analysis", hint: "Security review",
    prompt: "Review this function for security issues and explain each one:\n\n```python\n# paste code here\n```" },
  { icon: "📜", label: "Log Analysis", hint: "Detect anomalies",
    prompt: "Here are some auth log lines from my lab server. Help me identify signs of brute-force activity:\n\n```\n# paste log lines here\n```" },
  { icon: "🏁", label: "CTF / Lab", hint: "Challenges & walkthroughs",
    prompt: "I'm stuck on a CTF web challenge involving an IDOR. Explain the vulnerability class and a general approach to testing for it in my lab." },
  { icon: "🔒", label: "Secure Coding", hint: "Best practices",
    prompt: "Show a secure way to handle user file uploads in a Python FastAPI app, and explain the risks of a naive implementation." },
  { icon: "🕸️", label: "Web Exploitation", hint: "XSS · SQLi · SSRF",
    prompt: "For my authorized web pentest lab, explain the OWASP Top 10 web exploitation classes (XSS, SQLi, SSRF, IDOR, auth bypass) and a general testing approach for each." },
  { icon: "🧠", label: "Vuln Explanation", hint: "Deep dives",
    prompt: "Explain SSRF: what it is, why it's dangerous, and common mitigations, at a level suitable for a junior security analyst." },
  { icon: "📝", label: "Report Writing", hint: "Professional findings",
    prompt: "Help me write a clear, professional finding for a security report describing a reflected XSS I found in my authorized test lab, including impact and remediation." },
  { icon: "🐧", label: "Linux / Tools", hint: "CLI & security tools",
    prompt: "Explain what nmap, netcat, and tcpdump are each commonly used for during authorized security assessments." }
];

/* ── State ───────────────────────────────────────────────── */
const state = {
  tier: "low",
  history: [],
  sending: false,
  msgCount: 0
};

/* ── Elements ────────────────────────────────────────────── */
const el = {
  chatScroll:    document.getElementById("chatScroll"),
  welcome:       document.getElementById("welcome"),
  welcomeGrid:   document.getElementById("welcomeGrid"),
  messages:      document.getElementById("messages"),
  form:          document.getElementById("composerForm"),
  input:         document.getElementById("promptInput"),
  sendBtn:       document.getElementById("sendBtn"),
  categoryList:  document.getElementById("categoryList"),
  statusDot:     document.getElementById("statusDot"),
  statusLabel:   document.getElementById("statusLabel"),
  modelPill:     document.getElementById("modelPill"),
  charCount:     document.getElementById("charCount"),
  msgCount:      document.getElementById("msgCount"),
  tokenEst:      document.getElementById("tokenEst"),
  toast:         document.getElementById("toast"),
  modelBar:      document.getElementById("modelBar"),
  barIcon:       document.getElementById("barIcon"),
  barName:       document.getElementById("barName"),
  barParams:     document.getElementById("barParams"),
  barSize:       document.getElementById("barSize"),
  barRam:        document.getElementById("barRam"),
  barBadge:      document.getElementById("barBadge"),
  mdcTier:       document.getElementById("mdcTier"),
  mdcName:       document.getElementById("mdcName"),
  mdcParams:     document.getElementById("mdcParams"),
  mdcSize:       document.getElementById("mdcSize"),
  mdcRam:        document.getElementById("mdcRam"),
};

/* ── Tier switcher ───────────────────────────────────────── */
function setTier(tier) {
  state.tier = tier;
  const m = MODELS[tier];

  // Drive the whole-UI theme (LOW=green, MEDIUM=blue, HIGH=red)
  document.body.dataset.tier = tier;

  // Topbar buttons
  document.querySelectorAll(".tier-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tier === tier);
  });

  // Tier cards in welcome
  document.querySelectorAll(".tier-card").forEach(c => {
    c.classList.toggle("active", c.dataset.tier === tier);
  });

  // Model bar
  el.barIcon.textContent   = m.icon;
  el.barName.textContent   = m.id;
  el.barParams.textContent = m.params;
  el.barSize.textContent   = m.size;
  el.barRam.textContent    = m.ram;
  el.barBadge.textContent  = m.badge;
  el.barBadge.className    = `model-bar-badge tier-${tier}`;
  el.modelBar.className    = `model-bar tier-${tier}`;

  // Status pill
  el.modelPill.textContent = m.id;

  // Sidebar detail card
  el.mdcTier.textContent   = m.label;
  el.mdcTier.className     = `mdc-tier tier-${tier}`;
  el.mdcName.textContent   = m.id;
  el.mdcParams.textContent = m.params;
  el.mdcSize.textContent   = m.size;
  el.mdcRam.textContent    = m.ram;

  showToast(`Switched to ${m.label} — ${m.id}`);
}

document.querySelectorAll(".tier-btn, .tier-card").forEach(btn => {
  btn.addEventListener("click", () => {
    const tier = btn.dataset.tier;
    if (tier) setTier(tier);
  });
});

/* ── Categories ──────────────────────────────────────────── */
function renderCategories() {
  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-chip";
    btn.innerHTML = `<span class="icon">${cat.icon}</span><span>${cat.label}</span>`;
    btn.addEventListener("click", () => loadPrompt(cat, btn));
    el.categoryList.appendChild(btn);
  });
}

function renderWelcomeGrid() {
  CATEGORIES.slice(0, 4).forEach(cat => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "welcome-card";
    card.innerHTML = `
      <span class="welcome-card-icon">${cat.icon}</span>
      <div>
        <div class="welcome-card-label">${cat.label}</div>
        <div class="welcome-card-hint">${cat.hint}</div>
      </div>`;
    card.addEventListener("click", () => loadPrompt(cat));
    el.welcomeGrid.appendChild(card);
  });
}

function loadPrompt(cat, btn) {
  el.input.value = cat.prompt;
  autoGrow(el.input);
  updateCharCount();
  el.input.focus();
  document.querySelectorAll(".category-chip").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

/* ── Input helpers ───────────────────────────────────────── */
function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
}

function updateCharCount() {
  const len = el.input.value.length;
  el.charCount.textContent = `${len} / 6000`;
  el.charCount.className = len > 5400 ? "char-count danger" : len > 4200 ? "char-count warn" : "char-count";
}

el.input.addEventListener("input", () => { autoGrow(el.input); updateCharCount(); });
el.input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.form.requestSubmit(); }
});

/* ── Toast ───────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

/* ── Stats ───────────────────────────────────────────────── */
function updateStats() {
  el.msgCount.textContent = state.msgCount;
  const chars = state.history.reduce((s, m) => s + m.content.length, 0);
  const est   = Math.round(chars / 4);
  el.tokenEst.textContent = est > 999 ? `~${(est / 1000).toFixed(1)}k` : `~${est}`;
}

/* ── Markdown renderer ───────────────────────────────────── */
function renderMessageBody(container, text) {
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || "code";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      appendCodeBlock(container, codeLines.join("\n"), lang);
      i++;
      continue;
    }

    const h1 = line.match(/^# (.+)/), h2 = line.match(/^## (.+)/), h3 = line.match(/^### (.+)/);
    if (h1 || h2 || h3) {
      const lvl = h1 ? "h1" : h2 ? "h2" : "h3";
      const node = document.createElement(lvl);
      appendInline(node, (h1 || h2 || h3)[1]);
      container.appendChild(node);
      i++; continue;
    }

    if (line.trim().match(/^---+$/)) {
      container.appendChild(document.createElement("hr"));
      i++; continue;
    }

    if (line.match(/^[\-\*] /)) {
      const ul = document.createElement("ul");
      while (i < lines.length && lines[i].match(/^[\-\*] /)) {
        const li = document.createElement("li");
        appendInline(li, lines[i].slice(2));
        ul.appendChild(li);
        i++;
      }
      container.appendChild(ul);
      continue;
    }

    if (line.match(/^\d+\. /)) {
      const ol = document.createElement("ol");
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        const li = document.createElement("li");
        appendInline(li, lines[i].replace(/^\d+\. /, ""));
        ol.appendChild(li);
        i++;
      }
      container.appendChild(ol);
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    const p = document.createElement("p");
    appendInline(p, line);
    container.appendChild(p);
    i++;
  }
}

function appendInline(container, text) {
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`\n]+)`)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (m[1].startsWith("***"))      { const s = document.createElement("strong"); const e = document.createElement("em"); e.textContent = m[2]; s.appendChild(e); container.appendChild(s); }
    else if (m[1].startsWith("**")) { const s = document.createElement("strong"); s.textContent = m[3]; container.appendChild(s); }
    else if (m[1].startsWith("*"))  { const e = document.createElement("em"); e.textContent = m[4]; container.appendChild(e); }
    else if (m[1].startsWith("`"))  { const c = document.createElement("code"); c.textContent = m[5]; container.appendChild(c); }
    last = re.lastIndex;
  }
  if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
}

function appendCodeBlock(container, code, lang) {
  const wrap = document.createElement("div");
  wrap.className = "code-wrap";

  const hdr = document.createElement("div");
  hdr.className = "code-header";

  const langEl = document.createElement("span");
  langEl.className = "code-lang";
  langEl.textContent = lang || "code";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-btn";
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg> Copy`;

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(code.replace(/\n$/, "")).then(() => {
      copyBtn.textContent = "✓ Copied";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg> Copy`;
        copyBtn.classList.remove("copied");
      }, 2000);
    });
  });

  hdr.appendChild(langEl);
  hdr.appendChild(copyBtn);

  const pre = document.createElement("div");
  pre.className = "code-block";
  const codeEl = document.createElement("code");
  codeEl.textContent = code.replace(/\n$/, "");
  pre.appendChild(codeEl);

  wrap.appendChild(hdr);
  wrap.appendChild(pre);
  container.appendChild(wrap);
}

/* ── Messages ────────────────────────────────────────────── */
function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMessage(role, text, tier) {
  el.welcome.style.display = "none";

  const row = document.createElement("div");
  row.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "YOU" : "YRT";

  const content = document.createElement("div");
  content.className = "msg-content";

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const t = MODELS[tier || state.tier];
  meta.innerHTML = `<span>${timestamp()}</span>${role === "assistant" ? `<span class="msg-tier tier-${tier || state.tier}">${t?.icon || ""} ${t?.label || ""}</span>` : ""}`;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  renderMessageBody(bubble, text);

  content.appendChild(meta);
  content.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(content);
  el.messages.appendChild(row);
  scrollToBottom();
  state.msgCount++;
  updateStats();
}

function addErrorMessage(text) {
  el.welcome.style.display = "none";
  const row = document.createElement("div");
  row.className = "msg error";
  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "!";
  const content = document.createElement("div");
  content.className = "msg-content";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;
  content.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(content);
  el.messages.appendChild(row);
  scrollToBottom();
}

function addTypingIndicator(tier) {
  const row = document.createElement("div");
  row.className = "msg assistant";
  row.id = "typingRow";
  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "YRT";
  const content = document.createElement("div");
  content.className = "msg-content";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  const m = MODELS[tier || state.tier];
  bubble.innerHTML = `<div class="typing-wrap">
    <div class="typing"><span></span><span></span><span></span></div>
    <span class="typing-label">${m?.icon || ""} ${m?.id || "model"} thinking…</span>
  </div>`;
  content.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(content);
  el.messages.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

function scrollToBottom() {
  el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
}

/* ── Controls ────────────────────────────────────────────── */
function setSending(v) {
  state.sending = v;
  el.sendBtn.disabled = v;
  el.input.disabled = v;
}

function clearChat() {
  el.messages.innerHTML = "";
  state.history = [];
  state.msgCount = 0;
  el.welcome.style.display = "";
  updateStats();
  showToast("Chat cleared");
}

function newChat() {
  clearChat();
  el.input.value = "";
  autoGrow(el.input);
  updateCharCount();
  document.querySelectorAll(".category-chip").forEach(b => b.classList.remove("active"));
  el.input.focus();
}

/* ── Submit ──────────────────────────────────────────────── */
el.form.addEventListener("submit", async e => {
  e.preventDefault();
  if (state.sending) return;

  const text = el.input.value.trim();
  if (!text) return;

  const tier = state.tier;
  el.input.value = "";
  autoGrow(el.input);
  updateCharCount();
  setSending(true);

  addMessage("user", text, tier);
  state.history.push({ role: "user", content: text });
  addTypingIndicator(tier);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: state.history, tier })
    });

    const data = await res.json();
    removeTypingIndicator();

    if (!res.ok) {
      addErrorMessage(data.detail || "The local model returned an error.");
      state.history.pop();
    } else {
      addMessage("assistant", data.content, data.tier);
      state.history.push({ role: "assistant", content: data.content });
    }
  } catch {
    removeTypingIndicator();
    addErrorMessage("Could not reach the backend. Is the server running?");
    state.history.pop();
  } finally {
    setSending(false);
    el.input.focus();
  }
});

/* ── Status + model availability ─────────────────────────── */
async function refreshStatus() {
  try {
    const res  = await fetch("/api/models");
    const data = await res.json();

    for (const [tier, info] of Object.entries(data.models)) {
      const dot = document.getElementById(`avail-${tier}`);
      if (dot) {
        dot.textContent = info.available ? "●" : "○";
        dot.className   = `tier-avail ${info.available ? "avail-ok" : "avail-no"}`;
        dot.title       = info.available ? "Model ready" : "Not pulled yet";
      }
    }

    const cur = data.models[state.tier];
    if (cur) {
      el.statusDot.className = `status-dot ${cur.available ? "ok" : "warn"}`;
      el.statusLabel.textContent = cur.available ? "Ollama connected" : "Model not pulled";
    }
  } catch {
    el.statusDot.className = "status-dot down";
    el.statusLabel.textContent = "Backend unreachable";
  }
}

/* ── Init ────────────────────────────────────────────────── */
renderCategories();
renderWelcomeGrid();
const urlTier = new URLSearchParams(location.search).get("tier");
setTier(MODELS[urlTier] ? urlTier : "low");
refreshStatus();
setInterval(refreshStatus, 15000);
updateCharCount();
updateStats();
