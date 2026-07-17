/* ============================================================
   PIXAL PROMPT — LATENT experience layer v1
   One RAF: gsap.ticker drives Lenis + ScrollTrigger + the GL
   layer (js/gl.js). Everything enters by resolving from noise.
   ============================================================ */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NO_HOVER = window.matchMedia("(hover: none)").matches;
const HAS_GSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

const GLYPHS = "▓▒░<>/#01+*";
const rndGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

/* ---------- smooth scroll ---------- */
let lenis = null;
function initScroll() {
  if (REDUCED || !HAS_GSAP || typeof Lenis === "undefined") return;
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.PPLenis = lenis;
}

/* ---------- boot sequence (index only, ~2.4s, always skippable) ---------- */
function initBoot() {
  const boot = document.getElementById("boot");
  if (!boot) return;
  if (REDUCED || !HAS_GSAP) { boot.remove(); return; }

  document.body.classList.add("boot-lock");
  if (lenis) lenis.stop();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.body.classList.remove("boot-lock");
    if (lenis) lenis.start();
    document.dispatchEvent(new Event("pp:boot-done"));
    gsap.to(boot, {
      autoAlpha: 0,
      scale: 1.02,
      duration: 0.55,
      ease: "power2.inOut",
      onComplete: () => boot.remove(),
    });
    // the hero lands as the field bursts open
    gsap.from(".hero h1, .hero .whisper, .hero .sub", {
      y: 26,
      autoAlpha: 0,
      scale: 1.015,
      duration: 1.1,
      stagger: 0.09,
      ease: "expo.out",
      clearProps: "all",
    });
    window.removeEventListener("wheel", close);
    window.removeEventListener("keydown", close);
  };
  boot.addEventListener("pointerdown", close);
  window.addEventListener("wheel", close, { passive: true });
  window.addEventListener("keydown", close);

  const lines = boot.querySelectorAll(".term .ln");
  const texts = [
    { el: lines[0], html: `<span class="p">&gt;</span> pixal.render(idea)` },
    { el: lines[1], html: `&nbsp;&nbsp;sampling latent space… t=<span class="tval">1000</span>` },
    { el: lines[2], html: `&nbsp;&nbsp;everyone has the same tool. not everyone has taste.` },
  ];

  // type lines fast, then run the denoise counter, then enter
  const typeLine = (i, done) => {
    if (closed) return;
    if (i >= texts.length) { done(); return; }
    const { el, html } = texts[i];
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const full = tmp.textContent;
    let n = 0;
    const iv = setInterval(() => {
      if (closed) { clearInterval(iv); return; }
      n += 2;
      if (n >= full.length) {
        clearInterval(iv);
        el.innerHTML = html;
        setTimeout(() => typeLine(i + 1, done), 90);
      } else {
        el.textContent = full.slice(0, n) + rndGlyph();
      }
    }, 14);
  };

  typeLine(0, () => {
    if (closed) return;
    const tval = boot.querySelector(".tval");
    const state = { t: 1000 };
    const field = boot.querySelector(".static-field");
    gsap.to(state, {
      t: 0,
      duration: 1.5,
      ease: "power3.in",
      onUpdate: () => {
        if (tval) tval.textContent = String(Math.round(state.t)).padStart(4, "0");
        if (field) field.style.opacity = (0.16 * state.t) / 1000 + 0.02;
        document.dispatchEvent(new CustomEvent("pp:boot-t", { detail: state.t / 1000 }));
      },
      onComplete: () => setTimeout(close, 250),
    });
  });

  // hard ceiling — never hold the page hostage
  setTimeout(close, 4200);
}

/* ---------- scramble type: text resolves from glyph noise ---------- */
function scrambleIn(el) {
  if (el.dataset.scrambled) return;
  el.dataset.scrambled = "1";
  if (REDUCED) return;
  const original = el.textContent;
  if (!original.trim()) return;
  const len = original.length;
  const dur = Math.min(900, 260 + len * 24);
  const start = performance.now();
  const tick = () => {
    const p = Math.min(1, (performance.now() - start) / dur);
    const solved = Math.floor(p * len);
    let out = original.slice(0, solved);
    for (let i = solved; i < len; i++) {
      out += original[i] === " " ? " " : rndGlyph();
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = original;
  };
  tick();
}

let _scrambleIO;
function bindScrambles() {
  if (!_scrambleIO) {
    _scrambleIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        _scrambleIO.unobserve(e.target);
        scrambleIn(e.target);
      });
    }, { threshold: 0.3 });
  }
  document.querySelectorAll("[data-scramble]:not([data-sw])").forEach((el) => {
    el.dataset.sw = "1";
    _scrambleIO.observe(el);
  });
}

/* ---------- cursor: acid dot + bracket frame + spark trail ---------- */
let cursorEl, labelEl, frameEl;
function initCursor() {
  if (NO_HOVER || !HAS_GSAP) return;
  cursorEl = document.createElement("div");
  cursorEl.className = "cursor";
  labelEl = document.createElement("div");
  labelEl.className = "cursor-label";
  frameEl = document.createElement("div");
  frameEl.className = "cursor-frame";
  frameEl.innerHTML = "<span></span><span></span><span></span><span></span>";
  document.body.append(cursorEl, labelEl, frameEl);

  const cx = gsap.quickTo(cursorEl, "x", { duration: 0.12, ease: "power2" });
  const cy = gsap.quickTo(cursorEl, "y", { duration: 0.12, ease: "power2" });
  const lx = gsap.quickTo(labelEl, "x", { duration: 0.18, ease: "power2" });
  const ly = gsap.quickTo(labelEl, "y", { duration: 0.18, ease: "power2" });
  document.addEventListener("mousemove", (e) => {
    cx(e.clientX); cy(e.clientY);
    lx(e.clientX); ly(e.clientY);
  });
  bindCursorTargets();
}

function bindCursorTargets() {
  if (!frameEl) return;
  document.querySelectorAll("[data-cursor]").forEach((t) => {
    if (t._cb) return;
    t._cb = true;
    t.addEventListener("mouseenter", () => {
      const r = t.getBoundingClientRect();
      gsap.killTweensOf(frameEl);
      gsap.set(frameEl, { opacity: 0 });
      gsap.to(frameEl, {
        opacity: 1,
        left: r.left - 6,
        top: r.top - 6,
        width: r.width + 12,
        height: r.height + 12,
        duration: 0.28,
        ease: "expo.out",
      });
      labelEl.textContent = "[ " + t.dataset.cursor + " ]";
      gsap.to(labelEl, { opacity: 1, duration: 0.2 });
    });
    t.addEventListener("mouseleave", () => {
      gsap.to(frameEl, { opacity: 0, duration: 0.2 });
      gsap.to(labelEl, { opacity: 0, duration: 0.15 });
    });
  });
}

function initTrail() {
  if (REDUCED || NO_HOVER || !HAS_GSAP) return;
  const c = document.createElement("canvas");
  c.className = "trail";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const size = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
  size();
  window.addEventListener("resize", size);

  const sparks = [];
  document.addEventListener("mousemove", (e) => {
    if (sparks.length > 110) return;
    for (let i = 0; i < 2; i++) {
      sparks.push({
        x: e.clientX, y: e.clientY,
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.5) * 1.6 + 0.4,
        life: 1,
      });
    }
  });
  gsap.ticker.add(() => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy;
      s.vy += 0.02;
      s.life -= 0.028;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(212,255,0,${s.life * 0.75})`;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
  });
}

/* ---------- feed: pinned horizontal scrub (desktop) ---------- */
function bindFeedScrub() {
  if (REDUCED || !HAS_GSAP || window.innerWidth < 821) return;
  const sec = document.getElementById("feed");
  const track = sec && sec.querySelector(".feed-track");
  if (!track || sec.dataset.bound || !track.children.length) return;
  if (track.scrollWidth <= window.innerWidth) return;
  sec.dataset.bound = "1";
  gsap.to(track, {
    x: () => -(track.scrollWidth - window.innerWidth + 60),
    ease: "none",
    scrollTrigger: {
      trigger: sec,
      start: "top top",
      end: () => "+=" + (track.scrollWidth - window.innerWidth + 60),
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });
}

/* ---------- terminal panels: lines land staggered ---------- */
function bindTermPanels() {
  document.querySelectorAll(".term-panel:not([data-bound])").forEach((panel) => {
    panel.dataset.bound = "1";
    const lines = panel.querySelectorAll(".ln");
    if (REDUCED || !HAS_GSAP) { lines.forEach((l) => l.classList.add("on")); return; }
    ScrollTrigger.create({
      trigger: panel,
      start: "top 78%",
      once: true,
      onEnter: () => lines.forEach((l, i) => setTimeout(() => l.classList.add("on"), i * 340)),
    });
  });
}

/* ---------- statement: words resolve from glyph noise on scrub ---------- */
const _noisyStatements = [];
function bindStatements() {
  document.querySelectorAll(".statement[data-scrub]:not([data-bound])").forEach((st) => {
    st.dataset.bound = "1";
    const words = [];
    const wrap = (node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((tok) => {
          if (/^\s+$/.test(tok) || tok === "") frag.appendChild(document.createTextNode(tok));
          else {
            const s = document.createElement("span");
            s.className = "w";
            s.dataset.word = tok;
            s.textContent = tok;
            frag.appendChild(s);
            words.push(s);
          }
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.tagName === "EM") {
        node.classList.add("w", "is-em");
        node.dataset.word = node.textContent;
        words.push(node);
      } else if (node.nodeType === 1) {
        [...node.childNodes].forEach(wrap);
      }
    };
    [...st.childNodes].forEach(wrap);

    if (REDUCED || !HAS_GSAP) {
      words.forEach((w) => { if (w.classList.contains("is-em")) w.classList.add("acid"); });
      return;
    }
    words.forEach((w) => {
      w.classList.add("noisy");
      w.textContent = [...w.dataset.word].map((ch) => (ch === " " ? " " : rndGlyph())).join("");
    });
    const entry = { words, resolved: 0, el: st };
    _noisyStatements.push(entry);
    ScrollTrigger.create({
      trigger: st,
      start: "top 85%",
      end: "top 30%",
      scrub: true,
      onUpdate: (self) => {
        entry.resolved = Math.floor(self.progress * words.length + 0.0001);
        words.forEach((w, i) => {
          if (i < entry.resolved && w.classList.contains("noisy")) {
            w.classList.remove("noisy");
            w.textContent = w.dataset.word;
            if (w.classList.contains("is-em")) w.classList.add("acid");
          }
        });
      },
    });
  });
}
// unresolved words keep seething
setInterval(() => {
  for (const s of _noisyStatements) {
    const r = s.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    s.words.forEach((w, i) => {
      if (i >= s.resolved) {
        w.textContent = [...w.dataset.word].map((ch) => (ch === " " ? " " : rndGlyph())).join("");
      }
    });
  }
}, 140);

/* ---------- footer wordmark fills when reached ---------- */
function bindWordmark() {
  const wm = document.querySelector("footer .wordmark:not([data-bound])");
  if (!wm) return;
  wm.dataset.bound = "1";
  if (REDUCED || !HAS_GSAP) { wm.classList.add("lit"); return; }
  ScrollTrigger.create({
    trigger: wm,
    start: "top 85%",
    once: true,
    onEnter: () => setTimeout(() => wm.classList.add("lit"), 350),
  });
}

/* ---------- hero mouse drift: type and whisper on separate depths ---------- */
function initHeroDrift() {
  if (REDUCED || NO_HOVER || !HAS_GSAP) return;
  const h1 = document.querySelector(".hero h1");
  const wh = document.querySelector(".hero .whisper");
  if (!h1) return;
  const hx = gsap.quickTo(h1, "x", { duration: 0.8, ease: "power3" });
  const hy = gsap.quickTo(h1, "y", { duration: 0.8, ease: "power3" });
  const wx = wh && gsap.quickTo(wh, "x", { duration: 1.1, ease: "power3" });
  const wy = wh && gsap.quickTo(wh, "y", { duration: 1.1, ease: "power3" });
  document.addEventListener("mousemove", (e) => {
    const tx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ty = (e.clientY / window.innerHeight - 0.5) * 2;
    hx(-tx * 12); hy(-ty * 7);
    if (wx) { wx(-tx * 22); wy(-ty * 12); }
  });
}

/* ---------- grain ---------- */
function initGrain() {
  if (!document.querySelector(".grain")) {
    const g = document.createElement("div");
    g.className = "grain";
    document.body.appendChild(g);
  }
}

/* ---------- afterRender ---------- */
let _refreshT;
function afterRender() {
  bindScrambles();
  bindCursorTargets();
  bindFeedScrub();
  bindTermPanels();
  bindStatements();
  bindWordmark();
  if (window.PPGL && window.PPGL.sync) window.PPGL.sync();
  if (HAS_GSAP && !REDUCED) {
    clearTimeout(_refreshT);
    _refreshT = setTimeout(() => ScrollTrigger.refresh(), 160);
  }
}

window.PP = { afterRender, get lenis() { return lenis; } };

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initGrain();
  initScroll();
  initCursor();
  initTrail();
  initHeroDrift();
  initBoot();
  afterRender();
});
