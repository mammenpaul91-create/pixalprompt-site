/* ============================================================
   PIXAL PROMPT — site engine v6
   Sheet-driven content · diffusion reveal · intro gate · cursor
   ============================================================ */

/* ----------------- CONFIG — edit these ----------------- */
const CONFIG = {
  SHEET_ID: "1uQx6yNFHM7pPo7lsjJ4qNgJgOKEs5tE_hUWrOAcyehU",
  EMAIL: "pixalprompt@gmail.com",
  INSTAGRAM: "https://instagram.com/pixalprompt",
  // Ambient hero band under the headline. NOT clickable, NOT a project.
  // Swap this for a Cloudinary .mp4 URL to make it a looping film.
  HERO_MEDIA: "https://res.cloudinary.com/pixalprompt/image/upload/v1781255389/hero-band_nryqal.png",
};
/* -------------------------------------------------------- */

const sheetUrl = (tab) =>
  `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

/* ---------- CSV parser ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = (r[i] || "").trim()));
    return o;
  });
}

async function fetchTab(tab) {
  const res = await fetch(sheetUrl(tab));
  if (!res.ok) throw new Error("Sheet fetch failed");
  return rowsToObjects(parseCSV(await res.text()));
}

/* ---------- image URL resolver with placeholder fallback ---------- */
function isRealUrl(u) {
  return u && u.startsWith("http") && !u.includes("your-account") && !u.includes("paste-");
}
function cdn(url, width) {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/image/upload/", `/image/upload/w_${width},q_auto,f_auto/`);
}
function imgSrc(url, seed, width) {
  if (isRealUrl(url)) return cdn(url, width);
  const h = Math.round(width * 0.75);
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${h}`;
}

/* ---------- video embed normaliser ---------- */
function toEmbed(url) {
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

/* ---------- framed image ---------- */
function framedImg(src, alt) {
  return `<div class="frame-wrap"><span class="cm"></span><div class="frame"><img class="px" src="${src}" alt="${alt}" loading="lazy" crossorigin="anonymous"></div></div>`;
}

/* ---------- projects ---------- */
let _projects = null;
async function getProjects() {
  if (_projects) return _projects;
  const all = await fetchTab("Projects");
  _projects = all
    .filter((p) => p.published === "yes" && p.id && !p.id.includes("slug-here"))
    .sort((a, b) => (parseInt(a.display_order) || 99) - (parseInt(b.display_order) || 99));
  return _projects;
}

const SUBTEXT_POOL = [
  "world-building over output.",
  "same tools. different hands.",
  "built with intention, not iteration counts.",
  "the brief asked for safe. we declined.",
  "taste is the only parameter that matters.",
  "made slowly, on purpose.",
];
function subFor(p, i) {
  if (p.description_short && !p.description_short.includes("One-line")) return p.description_short;
  return SUBTEXT_POOL[i % SUBTEXT_POOL.length];
}
function projectCard(p, i = 0) {
  const n = String(i + 1).padStart(2, "0");
  return `
    <a class="card reveal" href="project.html?id=${encodeURIComponent(p.id)}" data-cursor="view →">
      <span class="idx">${n}</span>
      ${framedImg(imgSrc(p.thumbnail_url, p.id + "-thumb", 1400), p.title)}
      <div class="cap">
        <h3>${p.title}</h3>
        <p class="sub">${subFor(p, i)}</p>
        <span class="tag">[ ${(p.category || "work").toLowerCase()}${p.year ? " · " + p.year : ""} ]</span>
      </div>
    </a>`;
}

function fillInlineThumbs(projects) {
  document.querySelectorAll(".inline-thumb").forEach((slot) => {
    if (slot.dataset.filled) return;
    const p = projects[parseInt(slot.dataset.thumb) || 0];
    if (!p) return;
    slot.dataset.filled = "1";
    slot.innerHTML = `<img src="${imgSrc(p.thumbnail_url, p.id + "-inline", 400)}" alt="${p.title}" loading="lazy">`;
  });
}

async function renderFeatured(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const band = document.getElementById("hero-band");
  try {
    const all = await getProjects();
    fillInlineThumbs(all);
    const projects = all.filter((p) => p.featured === "yes").slice(0, 4);
    if (band) {
      const m = CONFIG.HERO_MEDIA || "";
      const isVideo = m.match(/\.(mp4|webm|mov)(\?|$)/i);
      band.innerHTML = isVideo
        ? `<div class="frame"><video src="${m}" autoplay muted loop playsinline></video></div>`
        : `<div class="frame"><img class="px" src="${cdn(m, 2200)}" alt="Pixal Prompt" crossorigin="anonymous"></div>`;
    }
    el.innerHTML = projects.length ? projects.map((p, i) => projectCard(p, i)).join("") : `<p class="empty">work coming soon.</p>`;
    afterRender();
  } catch {
    el.innerHTML = `<p class="empty">couldn't load work — check the sheet is shared (anyone with link, viewer).</p>`;
  }
}

async function renderWorkGrid(elId, filtersId) {
  const el = document.getElementById(elId);
  const filtersEl = document.getElementById(filtersId);
  if (!el) return;
  try {
    const projects = await getProjects();
    fillInlineThumbs(projects);
    const cats = ["All", ...new Set(projects.map((p) => p.category).filter(Boolean))];
    if (filtersEl) {
      filtersEl.innerHTML = cats.map((c, i) => `<button class="${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
      filtersEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        filtersEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const cat = btn.dataset.cat;
        const list = cat === "All" ? projects : projects.filter((p) => p.category === cat);
        el.innerHTML = list.length ? list.map((p, i) => projectCard(p, i)).join("") : `<p class="empty">nothing here yet.</p>`;
        afterRender();
      });
    }
    el.innerHTML = projects.length ? projects.map((p, i) => projectCard(p, i)).join("") : `<p class="empty">work coming soon.</p>`;
    afterRender();
  } catch {
    el.innerHTML = `<p class="empty">couldn't load work — check the sheet is shared (anyone with link, viewer).</p>`;
  }
}

/* ---------- project detail ---------- */
async function renderProject() {
  const wrap = document.getElementById("project");
  if (!wrap) return;
  const id = new URLSearchParams(location.search).get("id");
  try {
    const projects = await getProjects();
    const p = projects.find((x) => x.id === id);
    if (!p) {
      wrap.innerHTML = `<p class="empty">project not found. <a href="work.html" style="color:var(--accent)">back to work →</a></p>`;
      return;
    }
    document.title = `${p.title} — Pixal Prompt`;

    let media = "";
    if (isRealUrl(p.video_file_url)) {
      media += `<video src="${p.video_file_url}" autoplay muted loop playsinline controls></video>`;
    }
    media += framedImg(imgSrc(p.hero_url, p.id + "-hero", 2000), p.title);
    if (isRealUrl(p.video_embed_url)) {
      media += `<div class="embed"><iframe src="${toEmbed(p.video_embed_url)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    }
    (p.gallery_urls || "")
      .split("|").map((u) => u.trim()).filter(Boolean)
      .forEach((u, i) => {
        if (u.match(/\.(mp4|webm|mov)(\?|$)/i)) media += `<video src="${u}" muted loop playsinline controls></video>`;
        else media += framedImg(imgSrc(u, p.id + "-g" + i, 2000), p.title);
      });

    wrap.innerHTML = `
      <a class="back-link" href="work.html">← all work</a>
      <h1>${p.title}</h1>
      <div class="project-meta">
        <div><span class="label">Client</span>${p.client || "—"}</div>
        <div><span class="label">Year</span>${p.year || "—"}</div>
        <div><span class="label">Category</span>${p.category || "—"}</div>
        ${p.tags ? `<div><span class="label">Scope</span>${p.tags}</div>` : ""}
      </div>
      <p class="project-body">${p.description_long || p.description_short || ""}</p>
      <div class="media-stack">${media}</div>`;
    afterRender();
  } catch {
    wrap.innerHTML = `<p class="empty">couldn't load this project right now.</p>`;
  }
}

/* ---------- team (display_order 1 sits in the CENTER) ---------- */
async function renderTeam(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    let team = (await fetchTab("Team"))
      .filter((t) => t.active === "yes" && t.name && !t.name.includes("Member Name"))
      .sort((a, b) => (parseInt(a.display_order) || 99) - (parseInt(b.display_order) || 99));
    if (team.length === 3) team = [team[1], team[0], team[2]];
    el.innerHTML = team.length
      ? team.map((t) => `
        <div class="team-card reveal">
          ${framedImg(imgSrc(t.photo_url, "team-" + t.name, 800), t.name)}
          <h3>${t.name}</h3>
          <p class="role">${t.role || ""}</p>
          <p class="bio">${t.bio_short || ""}</p>
          <div class="links">
            ${isRealUrl(t.instagram) ? `<a href="${t.instagram}" target="_blank" rel="noopener">instagram</a>` : ""}
            ${isRealUrl(t.linkedin) ? `<a href="${t.linkedin}" target="_blank" rel="noopener">linkedin</a>` : ""}
          </div>
        </div>`).join("")
      : `<p class="empty">team coming soon.</p>`;
    afterRender();
  } catch {
    el.innerHTML = `<p class="empty">couldn't load team right now.</p>`;
  }
}

/* ---------- life with simonelle feed ---------- */
async function renderSimonelle(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    const items = (await fetchTab("Simonelle"))
      .filter((r) => r.published === "yes" && isRealUrl(r.media_url))
      .sort((a, b) => (parseInt(a.display_order) || 99) - (parseInt(b.display_order) || 99));
    if (!items.length) {
      el.innerHTML = `<p class="empty">coming soon — add rows to the "Simonelle" tab in the sheet.</p>`;
      return;
    }
    el.innerHTML = items.map((r, i) => {
      const n = String(i + 1).padStart(2, "0");
      const isVideo = r.media_url.match(/\.(mp4|webm|mov)(\?|$)/i);
      const media = isVideo
        ? `<div class="frame-wrap"><div class="frame"><video src="${r.media_url}" muted loop playsinline autoplay></video></div></div>`
        : framedImg(cdn(r.media_url, 1400), r.caption || "Life with Simonelle");
      return `
        <div class="card reveal">
          <span class="idx">${n}</span>
          ${media}
          <div class="cap">
            ${r.brand ? `<h3>${r.brand}</h3>` : ""}
            ${r.caption ? `<p class="sub">${r.caption}</p>` : ""}
            <span class="tag">[ digital reflection${r.date ? " · " + r.date : ""} ]</span>
          </div>
        </div>`;
    }).join("");
    afterRender();
  } catch {
    el.innerHTML = `<p class="empty">coming soon — add a "Simonelle" tab to the sheet.</p>`;
  }
}

/* ---------- diffusion reveal ---------- */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* ---------- intro gate: the logo sits INSIDE a living cloud ---------- */
function initIntro() {
  const intro = document.getElementById("intro");
  if (!intro) { typeHero(); return; }
  document.body.classList.add("intro-lock");

  let raf = null;
  const close = () => {
    intro.classList.add("done");
    document.body.classList.remove("intro-lock");
    setTimeout(() => { if (raf) cancelAnimationFrame(raf); intro.remove(); typeHero(); }, 950);
  };
  intro.addEventListener("click", close, { once: true });

  if (REDUCED) return;

  // two layers: mist behind the logo, mist in front of it
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

  // sprites: lit puff + shadow puff (clouds are light on top, dark underneath)
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

  // billowy cloud: several clusters around the logo, not one blob
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
      // sculpted volume: dark under-shadow, lit body on top
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

/* ---------- hero typing (hardened) ---------- */
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
  let stalled = setTimeout(finish, text.length * 90 + 2500); // hard fallback: always completes
  const tick = () => {
    if (i > text.length) { clearTimeout(stalled); finish(); return; }
    el.textContent = text.slice(0, i);
    i++;
    setTimeout(tick, 36 + Math.random() * 48);
  };
  setTimeout(tick, 350);
}

/* ============================================================
   ALIVE LAYER — scroll parallax, scrubbed band, mouse drift
   (vanilla approximation of the full GSAP build in CLAUDE.md)
   ============================================================ */
const _plx = [];
let _plxTicking = false;

function collectParallax() {
  // work collage: each card frame gets a depth speed by position pattern
  document.querySelectorAll(".grid .card:not([data-plx-done])").forEach((card, i) => {
    card.dataset.plxDone = "1";
    const fw = card.querySelector(".frame-wrap");
    if (!fw) return;
    const speeds = [0.05, 0.12, 0.09, 0.14, 0.04];
    _plx.push({ el: fw, speed: speeds[i % speeds.length], mode: "y" });
    fw.style.willChange = "transform";
  });
  // ghost index numerals drift faster (foreground layer)
  document.querySelectorAll(".grid .card .idx:not([data-plx-done])").forEach((idx, i) => {
    idx.dataset.plxDone = "1";
    _plx.push({ el: idx, speed: -0.08 - (i % 3) * 0.03, mode: "y" });
    idx.style.willChange = "transform";
  });
  // hero band scrub: scale + drift
  const band = document.querySelector(".hero-band img, .hero-band video");
  if (band && !band.dataset.plxDone) {
    band.dataset.plxDone = "1";
    _plx.push({ el: band, mode: "band" });
    band.style.willChange = "transform";
  }
}

function plxFrame() {
  _plxTicking = false;
  const vh = window.innerHeight;
  for (const p of _plx) {
    const r = p.el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) continue;
    const progress = (r.top + r.height / 2 - vh / 2) / (vh / 2); // -1 top … 1 bottom
    if (p.mode === "words") {
      const prog = Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (vh * 0.55)));
      const lit = Math.floor(prog * p.words.length);
      p.words.forEach((w, wi) => w.classList.toggle("lit", wi < lit));
      continue;
    }
    if (p.mode === "band") {
      const t = Math.min(1, Math.max(0, 1 - Math.abs(progress)));
      const scale = 1.12 - 0.12 * t;
      p.el.style.transform = `scale(${scale.toFixed(4)}) translateY(${(progress * 30).toFixed(1)}px)`;
    } else {
      p.el.style.transform = `translateY(${(-progress * p.speed * vh).toFixed(1)}px)`;
    }
  }
}
function onScrollPlx() {
  if (!_plxTicking) { _plxTicking = true; requestAnimationFrame(plxFrame); }
}

function splitStatements() {
  document.querySelectorAll(".statement.scrub").forEach((st) => {
    if (st.dataset.split) return;
    st.dataset.split = "1";
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
    _plx.push({ el: st, mode: "words", words: [...st.querySelectorAll(".w")] });
  });
}

function initAlive() {
  if (REDUCED) return;
  splitStatements();
  window.addEventListener("scroll", onScrollPlx, { passive: true });
  window.addEventListener("resize", onScrollPlx);
  onScrollPlx();

  // hero mouse drift — type and squiggle lean away from the cursor
  const h1 = document.querySelector(".hero h1");
  const sq = document.querySelector(".hero .squiggle");
  if (!h1) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  document.addEventListener("mousemove", (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  (function drift() {
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;
    h1.style.transform = `translate(${(-cx * 14).toFixed(2)}px, ${(-cy * 8).toFixed(2)}px)`;
    if (sq) sq.style.transform = `translate(${(-cx * 26).toFixed(2)}px, ${(-cy * 16).toFixed(2)}px)`;
    requestAnimationFrame(drift);
  })();
}

/* ---------- cursor trail: clean stroke that dissolves ---------- */
function initTrail() {
  if (REDUCED || window.matchMedia("(hover: none)").matches) return;
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

  (function draw() {
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
    requestAnimationFrame(draw);
  })();
}

/* ---------- living smoke drifting across the hero headline ---------- */
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

  // soft puff sprite tinted toward ink so it reads on paper
  const puff = document.createElement("canvas");
  puff.width = puff.height = 256;
  const pctx = puff.getContext("2d");
  const pg = pctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  pg.addColorStop(0, "rgba(96,90,79,0.32)");
  pg.addColorStop(0.5, "rgba(120,113,100,0.14)");
  pg.addColorStop(1, "rgba(0,0,0,0)");
  pctx.fillStyle = pg;
  pctx.fillRect(0, 0, 256, 256);

  const pale = document.createElement("canvas");
  pale.width = pale.height = 256;
  const qctx = pale.getContext("2d");
  const qg = qctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  qg.addColorStop(0, "rgba(250,247,240,0.5)");
  qg.addColorStop(0.5, "rgba(246,242,232,0.2)");
  qg.addColorStop(1, "rgba(0,0,0,0)");
  qctx.fillStyle = qg;
  qctx.fillRect(0, 0, 256, 256);

  const P = [];
  for (let i = 0; i < 26; i++) {
    P.push({
      x: Math.random() * 1.2 - 0.1,          // 0..1 across, wraps
      y: 0.28 + Math.random() * 0.5,          // hugs the headline zone
      r: 90 + Math.random() * 190,
      a: 0.22 + Math.random() * 0.3,
      v: 0.00025 + Math.random() * 0.00055,   // slow horizontal drift
      bob: Math.random() * Math.PI * 2,
      bobAmp: 8 + Math.random() * 18,
      pale: Math.random() < 0.45,
    });
  }

  let t = 0;
  (function frame() {
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
    requestAnimationFrame(frame);
  })();
}

/* ---------- custom cursor ---------- */
let cursorEl;
function initCursor() {
  if (window.matchMedia("(hover: none)").matches) return;
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

function afterRender() {
  observeReveals();
  bindCursorTargets();
  observeDiffusion();
  collectParallax();
  onScrollPlx();
}

/* ---------- nav / misc ---------- */
function initNav() {
  const btn = document.querySelector(".menu-btn");
  const nav = document.querySelector("header nav");
  if (btn && nav) {
    btn.addEventListener("click", () => {
      nav.classList.toggle("open");
      btn.textContent = nav.classList.contains("open") ? "close" : "menu";
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
  }
  const page = document.body.dataset.page;
  document.querySelectorAll(`header nav a[data-nav="${page}"]`).forEach((a) => a.classList.add("active"));
  document.querySelectorAll("[data-email]").forEach((el) => {
    el.textContent = el.dataset.emailLabel || CONFIG.EMAIL;
    el.href = "mailto:" + CONFIG.EMAIL;
  });
  document.querySelectorAll("[data-instagram]").forEach((el) => (el.href = CONFIG.INSTAGRAM));
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  if (!document.querySelector(".grain")) {
    const g = document.createElement("div");
    g.className = "grain";
    document.body.appendChild(g);
  }
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initCursor();
  initTrail();
  initHeroSmoke();
  initIntro();
  initAlive();
  afterRender();
  renderFeatured("featured-grid");
  renderWorkGrid("work-grid", "work-filters");
  renderProject();
  renderTeam("team-grid");
  renderSimonelle("simonelle-grid");
});
