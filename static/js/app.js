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
    id: "nous-hermes2:10.7b", label: "HIGH", icon: "🔥",
    params: "10.7B (Mixtral MoE)", size: "6.1 GB", ram: "~6 GB RAM", badge: "🔥 Powerful"
  },
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
  msgCount: 0,
  attachment: null  // {type:'text'|'image', name, content, mime, sizeLabel}
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
  attachBtn:     document.getElementById("attachBtn"),
  fileInput:     document.getElementById("fileInput"),
  attachPreview: document.getElementById("attachPreview"),
  micBtn:        document.getElementById("micBtn"),
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
  avatar.className = role === "user" ? "msg-avatar msg-avatar-user" : "msg-avatar msg-avatar-ai";
  if (role === "user") {
    avatar.textContent = "YOU";
  } else {
    avatar.innerHTML = '<img src="/static/assets/yamanredteam-logo.svg" class="msg-avatar-logo" alt="">';
  }

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
  return bubble;
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
  avatar.className = "msg-avatar msg-avatar-ai msg-avatar-thinking";
  avatar.innerHTML = '<img src="/static/assets/yamanredteam-logo.svg" class="msg-avatar-logo" alt="">';
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
  el.attachBtn.disabled = v;
  el.micBtn.disabled = v;
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

/* ── File / image attachment ─────────────────────────────── */
const TEXT_EXTS = new Set([".txt",".log",".py",".php",".js",".ts",".json",".xml",".sh",".sql",".conf",".md",".csv",".yaml",".yml",".html",".css"]);
const IMAGE_EXTS = new Set([".png",".jpg",".jpeg",".webp",".gif"]);
const MAX_TEXT_BYTES  = 50 * 1024;   // 50 KB
const MAX_IMAGE_BYTES =  5 * 1024 * 1024;  // 5 MB

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clearAttachment() {
  state.attachment = null;
  el.attachPreview.innerHTML = "";
  el.attachBtn.classList.remove("has-file");
  el.fileInput.value = "";
}

function showAttachChip(name, sizeLabel, icon) {
  el.attachPreview.innerHTML = "";
  const chip = document.createElement("div");
  chip.className = "attach-chip";
  chip.innerHTML = `
    <span class="attach-chip-icon">${icon}</span>
    <span class="attach-chip-name">${name}</span>
    <span class="attach-chip-size">${sizeLabel}</span>
    <button type="button" class="attach-chip-remove" title="Remove">✕</button>`;
  chip.querySelector(".attach-chip-remove").addEventListener("click", clearAttachment);
  el.attachPreview.appendChild(chip);
  el.attachBtn.classList.add("has-file");
}

function processFile(file) {
  if (!file) return;
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (IMAGE_EXTS.has(ext) || file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) { showToast("Image too large (max 5 MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(",")[1];
      const name = file.name || `image.${file.type.split("/")[1] || "png"}`;
      state.attachment = { type: "image", name, content: b64, mime: file.type };
      showAttachChip(name, fmtSize(file.size), "🖼️");
    };
    reader.readAsDataURL(file);
  } else if (TEXT_EXTS.has(ext)) {
    if (file.size > MAX_TEXT_BYTES) { showToast("File too large (max 50 KB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      state.attachment = { type: "text", name: file.name, content: reader.result, mime: file.type };
      showAttachChip(file.name, fmtSize(file.size), "📄");
    };
    reader.readAsText(file);
  } else {
    showToast("Unsupported type — use images or text/code files");
  }
}

el.attachBtn.addEventListener("click", () => { if (!state.sending) el.fileInput.click(); });
el.fileInput.addEventListener("change", () => { processFile(el.fileInput.files[0]); el.fileInput.value = ""; });

/* ── Drag-and-drop ───────────────────────────────────────── */
const dropOverlay = document.getElementById("dropOverlay");
let dragDepth = 0;

document.addEventListener("dragenter", e => {
  if (state.sending) return;
  e.preventDefault();
  dragDepth++;
  dropOverlay.classList.add("active");
});
document.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.classList.remove("active");
});
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop", e => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove("active");
  if (state.sending) return;
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

/* ── Paste image from clipboard ─────────────────────────── */
el.input.addEventListener("paste", e => {
  if (state.sending) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      e.preventDefault();
      processFile(item.getAsFile());
      return;
    }
  }
});

/* ── Voice input (Web Speech API) ───────────────────────── */
(function initMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    el.micBtn.title = "Voice input not supported in this browser (use Chrome)";
    el.micBtn.style.opacity = "0.35";
    el.micBtn.style.cursor  = "not-allowed";
    return;
  }

  const recognition = new SR();
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.lang            = "en-US";

  let isRecording  = false;
  let savedText    = "";   // text in box before mic started

  function startRec() {
    if (state.sending) return;
    savedText   = el.input.value;
    isRecording = true;
    el.micBtn.classList.add("recording");
    el.micBtn.title = "Recording… click to stop";
    showToast("🎤 Listening…");
    recognition.start();
  }

  function stopRec() {
    isRecording = false;
    el.micBtn.classList.remove("recording");
    el.micBtn.title = "Voice input";
    recognition.stop();
  }

  el.micBtn.addEventListener("click", () => {
    if (isRecording) stopRec();
    else startRec();
  });

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript).join("");
    el.input.value = savedText ? `${savedText} ${transcript}` : transcript;
    autoGrow(el.input);
    updateCharCount();
  };

  recognition.onend = () => {
    if (isRecording) {
      // auto-restarted mid-sentence on some browsers — restart
      recognition.start();
    } else {
      el.micBtn.classList.remove("recording");
      el.micBtn.title = "Voice input";
    }
  };

  recognition.onerror = (e) => {
    stopRec();
    const msgs = {
      "not-allowed":  "Mic permission denied — allow microphone access in browser.",
      "no-speech":    "No speech detected. Try again.",
      "network":      "Network error during speech recognition.",
      "aborted":      "",
    };
    const msg = msgs[e.error] || `Speech error: ${e.error}`;
    if (msg) showToast(msg);
  };
})();

/* ── Submit ──────────────────────────────────────────────── */
el.form.addEventListener("submit", async e => {
  e.preventDefault();
  if (state.sending) return;

  const text = el.input.value.trim();
  if (!text && !state.attachment) return;

  const tier = state.tier;
  const att  = state.attachment;   // snapshot before clearing

  el.input.value = "";
  autoGrow(el.input);
  updateCharCount();
  clearAttachment();
  setSending(true);

  // Show what the user is sending (message + optional file label)
  const displayText = text || `[Attached: ${att?.name}]`;
  addMessage("user", displayText, tier);
  state.history.push({ role: "user", content: displayText });
  addTypingIndicator(tier);

  let fullContent = "";
  let streamBubble = null;

  // Build fetch payload
  const payload = { messages: state.history, tier };
  if (att?.type === "text")  { payload.file_name = att.name; payload.file_content = att.content; }
  if (att?.type === "image") { payload.image_b64 = att.content; payload.image_mime = att.mime; }

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      removeTypingIndicator();
      addErrorMessage(data.detail || "The local model returned an error.");
      state.history.pop();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;

        let chunk;
        try { chunk = JSON.parse(raw); } catch { continue; }

        if (chunk.error) {
          removeTypingIndicator();
          if (streamBubble) {
            streamBubble.classList.remove("streaming");
            streamBubble.querySelector(".scan-line")?.remove();
            streamBubble.closest(".msg-content")?.querySelector(".stream-badge")?.remove();
          }
          addErrorMessage(chunk.error);
          state.history.pop();
          return;
        }

        if (chunk.content) {
          if (!streamBubble) {
            removeTypingIndicator();
            streamBubble = addMessage("assistant", "", tier);
            streamBubble.classList.add("streaming");

            // scan-line sweeps across the top of the bubble
            const scanLine = document.createElement("div");
            scanLine.className = "scan-line";
            streamBubble.prepend(scanLine);

            // "● live" badge in the message meta
            const meta = streamBubble.closest(".msg-content")?.querySelector(".msg-meta");
            if (meta) {
              const badge = document.createElement("span");
              badge.className = "stream-badge";
              badge.textContent = "live";
              meta.appendChild(badge);
            }
          }
          fullContent += chunk.content;
          streamBubble.textContent = fullContent;
          scrollToBottom();
        }
      }
    }

    if (streamBubble && fullContent) {
      streamBubble.classList.remove("streaming");
      streamBubble.querySelector(".scan-line")?.remove();
      streamBubble.closest(".msg-content")?.querySelector(".stream-badge")?.remove();
      streamBubble.innerHTML = "";
      renderMessageBody(streamBubble, fullContent);
      state.history.push({ role: "assistant", content: fullContent });
    } else if (!streamBubble) {
      removeTypingIndicator();
      addErrorMessage("Model returned an empty response.");
      state.history.pop();
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
