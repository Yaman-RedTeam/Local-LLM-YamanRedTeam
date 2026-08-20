/* ═══════════════════════════════════════════════════════════════════
   fx.js — ambient background particle network + tasteful 3D card tilt.
   Purely presentational. Reads the live --accent-rgb so it recolors with
   the active tier. Respects prefers-reduced-motion and coarse pointers.
   Does not touch any app.js state, API, or model logic.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("fx");

  /* ── Particle network ──────────────────────────────────────────── */
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, DPR = 1, particles = [], raf = 0;
    let accent = readAccent();

    function readAccent() {
      const v = getComputedStyle(document.body).getPropertyValue("--accent-rgb").trim();
      return v || "34, 227, 122";
    }

    // recolor the field when the tier (and thus accent) changes
    new MutationObserver(() => { accent = readAccent(); })
      .observe(document.body, { attributes: true, attributeFilter: ["data-tier"] });

    const rnd = (a, b) => a + Math.random() * (b - a);

    function makeParticle() {
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: rnd(-0.11, 0.11) * DPR, vy: rnd(-0.11, 0.11) * DPR,
        r: rnd(0.6, 1.8) * DPR,
      };
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = Math.floor(window.innerWidth * DPR);
      H = canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const target = Math.round(Math.min(58, (window.innerWidth * window.innerHeight) / 27000));
      particles = Array.from({ length: target }, makeParticle);
    }

    function draw(step) {
      ctx.clearRect(0, 0, W, H);
      const link = 120 * DPR;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (step) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + accent + ", 0.32)";
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < link * link) {
            const a = (1 - Math.sqrt(d2) / link) * 0.13;
            ctx.strokeStyle = "rgba(" + accent + ", " + a.toFixed(3) + ")";
            ctx.lineWidth = DPR * 0.55;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
      if (step) raf = requestAnimationFrame(() => draw(true));
    }

    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      resize();
      if (reduce) draw(false); else draw(true);
    }, { passive: true });

    resize();
    if (reduce) draw(false); else draw(true);
  }

  /* ── Tasteful 3D tilt on cards (fine pointers only) ────────────── */
  if (!reduce && !window.matchMedia("(pointer: coarse)").matches) {
    const MAX = 6; // degrees — restrained
    const bind = (card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          "perspective(900px) rotateX(" + (-py * MAX).toFixed(2) +
          "deg) rotateY(" + (px * MAX).toFixed(2) + "deg) translateY(-5px)";
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    };
    document.querySelectorAll(".tier-card, .welcome-card").forEach(bind);
  }
})();
