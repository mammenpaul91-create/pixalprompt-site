/* ============================================================
   PIXAL PROMPT — site engine v2
   Sheet-driven content · diffusion pixel-reveal · custom cursor
   ============================================================ */

/* ----------------- CONFIG — edit these ----------------- */
const CONFIG = {
  SHEET_ID: "1uQx6yNFHM7pPo7lsjJ4qNgJgOKEs5tE_hUWrOAcyehU",
  EMAIL: "pixalprompt@gmail.com",
  INSTAGRAM: "https://instagram.com/pixalprompt",
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

/* ---------- image URL resolver with placeholder fallback ----------
   Real Cloudinary URL  -> optimized delivery
   Anything else/empty  -> seeded placeholder so the site never looks broken */
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

/* ---------- framed image with crop marks + diffusion reveal ---------- */
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

function projectCard(p) {
  return `
    <a class="card reveal" href="project.html?id=${encodeURIComponent(p.id)}" data-cursor="view →">
      ${framedImg(imgSrc(p.thumbnail_url, p.id + "-thumb", 1200), p.title)}
      <div class="meta">
        <h3>${p.title}</h3>
        <span class="tag">${(p.category || "").toLowerCase()}${p.year ? " · " + p.year : ""}</span>
      </div>
    </a>`;
}

async function renderFeatured(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const band = document.getElementById("hero-band");
  try {
    let projects = (await getProjects()).filter((p) => p.featured === "yes").slice(0, 5);
    if (band && projects.length) {
      const b = projects[0];
      projects = projects.slice(1, 5);
      band.innerHTML = `
        <a href="project.html?id=${encodeURIComponent(b.id)}" data-cursor="view →">
          <div class="frame">
            <img class="px" src="${imgSrc(b.hero_url || b.thumbnail_url, b.id + "-band", 2000)}" alt="${b.title}" crossorigin="anonymous">
          </div>
          <span class="caption">${b.title} — ${(b.category || "").toLowerCase()}${b.year ? " · " + b.year : ""}</span>
        </a>`;
    }
    el.innerHTML = projects.length ? projects.map(projectCard).join("") : `<p class="empty">work coming soon.</p>`;
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
        el.innerHTML = list.length ? list.map(projectCard).join("") : `<p class="empty">nothing here yet.</p>`;
        afterRender();
      });
    }
    el.innerHTML = projects.length ? projects.map(projectCard).join("") : `<p class="empty">work coming soon.</p>`;
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
      wrap.innerHTML = `<p class="empty">project not found. <a href="work.html" style="color:var(--blue)">back to work →</a></p>`;
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

/* ---------- team ---------- */
async function renderTeam(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    const team = (await fetchTab("Team"))
      .filter((t) => t.active === "yes" && t.name && !t.name.includes("Member Name"))
      .sort((a, b) => (parseInt(a.display_order) || 99) - (parseInt(b.display_order) || 99));
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

/* ============================================================
   DIFFUSION REVEAL — images resolve from pixelated to sharp,
   the way a diffusion model denoises. The site's signature.
   ============================================================ */
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

/* ---------- hero typing ---------- */
function typeHero() {
  const el = document.querySelector(".prompt-line .typed");
  if (!el) return;
  const text = el.dataset.text || "";
  if (REDUCED) { el.textContent = text; return; }
  el.textContent = "";
  let i = 0;
  const tick = () => {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(tick, 36 + Math.random() * 48);
    }
  };
  setTimeout(tick, 400);
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
  typeHero();
  afterRender();
  renderFeatured("featured-grid");
  renderWorkGrid("work-grid", "work-filters");
  renderProject();
  renderTeam("team-grid");
});
