/* ============================================================
   PIXAL PROMPT — experience layer v14 (Session 1 scaffold)
   One RAF: gsap.ticker drives Lenis, ScrollTrigger and (later)
   the Three.js layer in js/gl.js.
   Session 2 replaces the intro fog with Three shader smoke.
   Session 3 builds the pinned scroll narrative.
   Session 4 replaces the canvas diffusion with a WebGL shader.
   ============================================================ */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NO_HOVER = window.matchMedia("(hover: none)").matches;
const HAS_GSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

/* ---------- smooth scroll: Lenis on the gsap ticker ---------- */
let lenis = null;
function initScroll() {
  if (REDUCED || !HAS_GSAP || typeof Lenis === "undefined") return;
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.PPLenis = lenis;
}

/* ---------- intro gate: logo inside a living cloud ----------
   (canvas version, ported from v13 — Three shader smoke lands
   in Session 2 and swaps this out) */
function initIntro() {
  const intro = document.getElementById("intro");
  if (!intro) { typeHero(); return; }
  document.body.classList.add("intro-lock");
  if (lenis) lenis.stop();

  let raf = null;
  const close = () => {
    intro.classList.add("done");
    document.body.classList.remove("intro-lock");
    if (lenis) lenis.start();
    setTimeout(() => { if (raf) cancelAnimationFrame(raf); intro.remove(); typeHero(); }, 950);
  };
  intro.addEventListener("click", close, { once: true });

  if (REDUCED) return;

  const back = document.createElement("canvas");
  back.className = "fog fog-back";
  const front = document.createElement("canvas");
  front.className = "fog fog-front";
  intro.prepend(back);
  intro.appendChild(front);
  const bctx = back.getContext("2d");
  const fctx = front.getContext("2d");
  let W, H, CX, CY;
  const size = () => {
    W = back.width = front.width = window.innerWidth;
    H = back.height = front.height = window.innerHeight;
    CX = W / 2; CY = H / 2;
  };
  size();
  window.addEventListener("resize", size);

  const makeSprite = (r, g, b, a) => {
    const s = document.createElement("canvas");
    s.width = s.height = 256;
    const sc = s.getContext("2d");
    const gr = sc.createRadialGradient(128, 118, 0, 128, 128, 128);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    gr.addColorStop(0.55, `rgba(${r},${g},${b},${a * 0.35})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    sc.fillStyle = gr;
    sc.fillRect(0, 0, 256, 256);
    return s;
  };
  const lit = makeSprite(226, 219, 205, 0.5);
  const shadow = makeSprite(38, 33, 26, 0.55);
  const ember = makeSprite(188, 74, 28, 0.22);

  const rnd = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
  const clusters = [
    { x: 0, y: 0, s: 1 },
    { x: -0.16, y: 0.06, s: 0.8 },
    { x: 0.15, y: -0.05, s: 0.85 },
    { x: 0.04, y: 0.12, s: 0.7 },
    { x: -0.07, y: -0.11, s: 0.65 },
  ];
  const P = [];
  const make = (layer, count) => {
    for (let i = 0; i < count; i++) {
      const cl = clusters[Math.floor(Math.random() * clusters.length)];
      const hx = CX + cl.x * W + rnd() * W * 0.13 * cl.s;
      const hy = CY + cl.y * H + rnd() * H * 0.16 * cl.s;
      P.push({
        hx, hy, x: hx, y: hy,
        r: (34 + Math.random() * 105) * cl.s * (layer === "front" ? 0.85 : 1),
        a: (layer === "front" ? 0.5 : 0.62) * (0.6 + Math.random() * 0.5),
        vx: 0, vy: 0,
        drift: 0.15 + Math.random() * 0.35,
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.05,
        fade: 1,
        layer,
      });
    }
  };
  make("back", 150);
  make("front", 70);

  let mx = -9999, my = -9999;
  intro.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; });
  intro.addEventListener("pointerleave", () => { mx = my = -9999; });

  let t = 0;
  function frame() {
    t += 0.007;
    bctx.clearRect(0, 0, W, H);
    fctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.ph += 0.004 * p.drift;
      const ox = Math.cos(p.ph) * 20 * p.drift + Math.cos(t * p.drift * 2) * 8;
      const oy = Math.sin(p.ph * 0.9) * 15 * p.drift + Math.sin(t * p.drift * 1.7) * 6;

      const dx = p.x - mx, dy = p.y - my;
      const d = Math.hypot(dx, dy);
      const R = 230;
      if (d < R && d > 0.01) {
        const f = (1 - d / R) * 3.4;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
        p.fade = Math.max(0.05, p.fade - (1 - d / R) * 0.11);
      }
      p.fade += (1 - p.fade) * 0.014;
      p.vx += (p.hx - p.x) * 0.004;
      p.vy += (p.hy - p.y) * 0.004;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x += p.vx; p.y += p.vy;

      const rr = p.r * (1 + Math.sin(t * 1.5 * p.drift + p.ph) * 0.08);
      const ctx2 = p.layer === "front" ? fctx : bctx;
      ctx2.globalAlpha = p.a * p.fade * 0.8;
      ctx2.drawImage(shadow, p.x + ox - rr, p.y + oy - rr + rr * 0.22, rr * 2, rr * 2);
      ctx2.globalAlpha = p.a * p.fade;
      ctx2.drawImage(p.warm ? ember : lit, p.x + ox - rr, p.y + oy - rr, rr * 2, rr * 2);
    }
    bctx.globalAlpha = fctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  frame();
}

/* ---------- hero typing (hardened: always completes) ---------- */
function typeHero() {
  const el = document.querySelector(".prompt-line .typed");
  if (!el || el.dataset.done) return;
  el.dataset.done = "1";
  const caret = document.querySelector(".prompt-line .caret");
  const text = el.dataset.text || "";
  const finish = () => {
    el.textContent = text;
    if (caret) setTimeout(() => caret.classList.add("off"), 1600);
  };
  if (REDUCED || !text) { finish(); return; }
  el.textContent = "";
  let i = 0;
  let stalled = setTimeout(finish, text.length * 90 + 2500);
  const tick = () => {
    if (i > text.length) { clearTimeout(stalled); finish(); return; }
    el.textContent = text.slice(0, i);
    i++;
    setTimeout(tick, 36 + Math.random() * 48);
  };
  setTimeout(tick, 350);
}

/* ---------- custom cursor: accent dot that morphs to a pill ---------- */
let cursorEl;
function initCursor() {
  if (NO_HOVER) return;
  cursorEl = document.createElement("div");
  cursorEl.className = "cursor";
  cursorEl.innerHTML = "<span></span>";
  document.body.appendChild(cursorEl);
  document.addEventListener("mousemove", (e) => {
    cursorEl.style.left = e.clientX + "px";
    cursorEl.style.top = e.clientY + "px";
  });
  bindCursorTargets();
}
function bindCursorTargets() {
  if (!cursorEl) return;
  document.querySelectorAll("[data-cursor]").forEach((t) => {
    if (t._cursorBound) return;
    t._cursorBound = true;
    t.addEventListener("mouseenter", () => {
      cursorEl.classList.add("is-label");
      cursorEl.querySelector("span").textContent = t.dataset.cursor;
    });
    t.addEventListener("mouseleave", () => cursorEl.classList.remove("is-label"));
  });
}

/* ---------- cursor ink trail ---------- */
function initTrail() {
  if (REDUCED || NO_HOVER) return;
  const c = document.createElement("canvas");
  c.className = "trail";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const size = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
  size();
  window.addEventListener("resize", size);

  const pts = [];
  let last = null;
  document.addEventListener("mousemove", (e) => {
    const now = performance.now();
    const p = { x: e.clientX, y: e.clientY, t: now };
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      const steps = Math.min(24, Math.floor(d / 5));
      for (let k = 1; k <= steps; k++) {
        pts.push({ x: last.x + ((p.x - last.x) * k) / (steps + 1), y: last.y + ((p.y - last.y) * k) / (steps + 1), t: now });
      }
    }
    pts.push(p);
    last = p;
  });

  const draw = () => {
    const now = performance.now();
    while (pts.length && now - pts[0].t > 550) pts.shift();
    ctx.clearRect(0, 0, c.width, c.height);
    if (pts.length > 2) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c2 = pts[i + 1];
        const age = (now - b.t) / 550;
        ctx.strokeStyle = `rgba(188, 74, 28, ${(1 - age) * 0.6})`;
        ctx.lineWidth = 1.8 * (1 - age) + 0.4;
        ctx.beginPath();
        ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.quadraticCurveTo(b.x, b.y, (b.x + c2.x) / 2, (b.y + c2.y) / 2);
        ctx.stroke();
      }
    }
  };
  if (HAS_GSAP) gsap.ticker.add(draw);
  else (function loop() { draw(); requestAnimationFrame(loop); })();
}

/* ---------- smoke wisps drifting across the hero headline ---------- */
function initHeroSmoke() {
  if (REDUCED) return;
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const c = document.createElement("canvas");
  c.className = "hero-smoke";
  hero.appendChild(c);
  const ctx = c.getContext("2d");
  let W, H;
  const size = () => {
    const r = hero.getBoundingClientRect();
    W = c.width = Math.round(r.width);
    H = c.height = Math.round(r.height);
  };
  size();
  window.addEventListener("resize", size);

  const sprite = (stops) => {
    const s = document.createElement("canvas");
    s.width = s.height = 256;
    const sc = s.getContext("2d");
    const g = sc.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    sc.fillStyle = g;
    sc.fillRect(0, 0, 256, 256);
    return s;
  };
  const puff = sprite([[0, "rgba(96,90,79,0.32)"], [0.5, "rgba(120,113,100,0.14)"], [1, "rgba(0,0,0,0)"]]);
  const pale = sprite([[0, "rgba(250,247,240,0.5)"], [0.5, "rgba(246,242,232,0.2)"], [1, "rgba(0,0,0,0)"]]);

  const P = [];
  for (let i = 0; i < 26; i++) {
    P.push({
      x: Math.random() * 1.2 - 0.1,
      y: 0.28 + Math.random() * 0.5,
      r: 90 + Math.random() * 190,
      a: 0.22 + Math.random() * 0.3,
      v: 0.00025 + Math.random() * 0.00055,
      bob: Math.random() * Math.PI * 2,
      bobAmp: 8 + Math.random() * 18,
      pale: Math.random() < 0.45,
    });
  }

  let t = 0;
  const frame = () => {
    t += 0.006;
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.x += p.v;
      if (p.x > 1.15) p.x = -0.15;
      const x = p.x * W;
      const y = p.y * H + Math.sin(t * 1.3 + p.bob) * p.bobAmp;
      const rr = p.r * (1 + Math.sin(t + p.bob) * 0.07);
      ctx.globalAlpha = p.a * (0.85 + Math.sin(t * 0.9 + p.bob) * 0.15);
      ctx.drawImage(p.pale ? pale : puff, x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.globalAlpha = 1;
  };
  if (HAS_GSAP) gsap.ticker.add(frame);
  else (function loop() { frame(); requestAnimationFrame(loop); })();
}

/* ---------- hero mouse drift (type + squiggle on separate depths) ---------- */
function initHeroDrift() {
  if (REDUCED || NO_HOVER || !HAS_GSAP) return;
  const h1 = document.querySelector(".hero h1");
  const sq = document.querySelector(".hero .squiggle");
  if (!h1) return;
  const h1x = gsap.quickTo(h1, "x", { duration: 0.7, ease: "power3" });
  const h1y = gsap.quickTo(h1, "y", { duration: 0.7, ease: "power3" });
  const sqx = sq && gsap.quickTo(sq, "x", { duration: 0.9, ease: "power3" });
  const sqy = sq && gsap.quickTo(sq, "y", { duration: 0.9, ease: "power3" });
  document.addEventListener("mousemove", (e) => {
    const tx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ty = (e.clientY / window.innerHeight - 0.5) * 2;
    h1x(-tx * 14); h1y(-ty * 8);
    if (sqx) { sqx(-tx * 26); sqy(-ty * 16); }
  });
}

/* ---------- diffusion reveal (canvas interim — shader in Session 4) ---------- */
function drawCover(ctx, img, w, h) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function diffuse(img) {
  if (img._diffused) return;
  img._diffused = true;
  if (REDUCED) return;
  const frame = img.closest(".frame");
  if (!frame) return;
  const rect = frame.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const c = document.createElement("canvas");
  c.className = "px-canvas";
  c.width = Math.round(rect.width);
  c.height = Math.round(rect.height);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  frame.appendChild(c);

  const steps = [0.012, 0.025, 0.05, 0.1, 0.2, 0.45];
  let i = 0;
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");

  const tick = () => {
    if (i >= steps.length) { c.remove(); return; }
    const f = steps[i];
    off.width = Math.max(2, Math.round(c.width * f));
    off.height = Math.max(2, Math.round(c.height * f));
    try {
      drawCover(octx, img, off.width, off.height);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(off, 0, 0, c.width, c.height);
    } catch (e) { c.remove(); return; }
    i++;
    setTimeout(tick, 105);
  };
  tick();
}

let _pxObserver;
function observeDiffusion() {
  if (!_pxObserver) {
    _pxObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const img = e.target;
        _pxObserver.unobserve(img);
        if (img.complete && img.naturalWidth) diffuse(img);
        else img.addEventListener("load", () => diffuse(img), { once: true });
      });
    }, { threshold: 0.15 });
  }
  document.querySelectorAll("img.px:not([data-px-watched])").forEach((img) => {
    img.dataset.pxWatched = "1";
    _pxObserver.observe(img);
  });
}

/* ---------- scroll reveals ---------- */
let _observer;
function observeReveals() {
  if (!_observer) {
    _observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.12 }
    );
  }
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => _observer.observe(el));
}

/* ---------- ScrollTrigger scenes (scaffold versions) ---------- */

/* statement word-by-word scrub — "Taste" lands last */
function bindStatements() {
  document.querySelectorAll(".statement.scrub:not([data-bound])").forEach((st) => {
    st.dataset.bound = "1";
    const wrapWords = (node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((tok) => {
          if (/^\s+$/.test(tok) || tok === "") { frag.appendChild(document.createTextNode(tok)); }
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = tok; frag.appendChild(s); }
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.tagName === "EM") {
        node.classList.add("w");
      } else if (node.nodeType === 1) {
        [...node.childNodes].forEach(wrapWords);
      }
    };
    [...st.childNodes].forEach(wrapWords);
    const words = [...st.querySelectorAll(".w")];
    if (REDUCED || !HAS_GSAP) { words.forEach((w) => w.classList.add("lit")); return; }
    ScrollTrigger.create({
      trigger: st,
      start: "top 88%",
      end: "top 35%",
      scrub: true,
      onUpdate: (self) => {
        const lit = Math.floor(self.progress * words.length + 0.0001);
        words.forEach((w, i) => w.classList.toggle("lit", i < lit));
      },
    });
  });
}

/* ambient film band: opens from inset clip to full-bleed on scrub */
function bindHeroBand() {
  if (REDUCED || !HAS_GSAP) return;
  const band = document.querySelector(".hero-band");
  const frame = band && band.querySelector(".frame");
  if (!frame || band.dataset.bound) return;
  band.dataset.bound = "1";
  const media = frame.querySelector("img, video");
  gsap.fromTo(frame,
    { clipPath: "inset(6% 8% 6% 8%)" },
    { clipPath: "inset(0% 0% 0% 0%)", ease: "none",
      scrollTrigger: { trigger: band, start: "top 90%", end: "top 25%", scrub: true } });
  if (media) {
    gsap.fromTo(media, { scale: 1.15 }, { scale: 1, ease: "none",
      scrollTrigger: { trigger: band, start: "top bottom", end: "bottom top", scrub: true } });
  }
}

/* collage depth: frames drift at pattern speeds, ghost numerals counter-drift */
function bindCards() {
  if (REDUCED || !HAS_GSAP) return;
  const speeds = [24, 60, 44, 72, 16];
  document.querySelectorAll(".grid .card:not([data-fx])").forEach((card, i) => {
    card.dataset.fx = "1";
    const fw = card.querySelector(".frame-wrap");
    const idx = card.querySelector(".idx");
    const s = speeds[i % speeds.length];
    if (fw) {
      gsap.fromTo(fw, { y: s * 0.6 }, { y: -s * 0.6, ease: "none",
        scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true } });
    }
    if (idx) {
      gsap.fromTo(idx, { y: -s * 0.5 }, { y: s * 0.8, ease: "none",
        scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true } });
    }
  });
}

/* ---------- film grain ---------- */
function initGrain() {
  if (!document.querySelector(".grain")) {
    const g = document.createElement("div");
    g.className = "grain";
    document.body.appendChild(g);
  }
}

/* ---------- afterRender: called by data.js when content lands ---------- */
let _refreshT;
function afterRender() {
  observeReveals();
  bindCursorTargets();
  observeDiffusion();
  bindStatements();
  bindHeroBand();
  bindCards();
  if (HAS_GSAP && !REDUCED) {
    clearTimeout(_refreshT);
    _refreshT = setTimeout(() => ScrollTrigger.refresh(), 150);
  }
}

window.PP = { afterRender, get lenis() { return lenis; } };

/* ---------- boot (runs before data.js's DOMContentLoaded handler) ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initGrain();
  initCursor();
  initTrail();
  initScroll();
  initHeroSmoke();
  initHeroDrift();
  initIntro();
  afterRender();
});
