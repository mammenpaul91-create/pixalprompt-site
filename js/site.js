/* ============================================================
   PIXAL PROMPT — site engine
   Reads content from Google Sheets, renders everything.
   ============================================================ */

/* ----------------- CONFIG — edit these ----------------- */
const CONFIG = {
  SHEET_ID: "1uQx6yNFHM7pPo7lsjJ4qNgJgOKEs5tE_hUWrOAcyehU",
  EMAIL: "pixalprompt@gmail.com",          // swap to hello@pixalprompt.com later
  INSTAGRAM: "https://instagram.com/pixalprompt", // update to real handle
  CLOUDINARY_CLOUD: "pixalprompt",
};
/* -------------------------------------------------------- */

const sheetUrl = (tab) =>
  `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

/* ---------- tiny CSV parser (handles quoted commas/newlines) ---------- */
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
  const text = await res.text();
  return rowsToObjects(parseCSV(text));
}

/* ---------- Cloudinary helper: inject transformations ---------- */
function cdn(url, width) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  const t = `w_${width},q_auto,f_auto`;
  return url.replace("/image/upload/", `/image/upload/${t}/`);
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
    <a class="card reveal" href="project.html?id=${encodeURIComponent(p.id)}" data-cursor="View">
      <div class="frame"><img src="${cdn(p.thumbnail_url, 1200)}" alt="${p.title}" loading="lazy"></div>
      <div class="meta">
        <h3>${p.title}</h3>
        <span class="tag">${p.category}${p.year ? " · " + p.year : ""}</span>
      </div>
    </a>`;
}

async function renderFeatured(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    const projects = (await getProjects()).filter((p) => p.featured === "yes").slice(0, 4);
    el.innerHTML = projects.length
      ? projects.map(projectCard).join("")
      : `<p class="empty">Work coming soon.</p>`;
    observeReveals();
  } catch {
    el.innerHTML = `<p class="empty">Couldn't load work right now.</p>`;
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
      filtersEl.innerHTML = cats
        .map((c, i) => `<button class="${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`)
        .join("");
      filtersEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        filtersEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const cat = btn.dataset.cat;
        const list = cat === "All" ? projects : projects.filter((p) => p.category === cat);
        el.innerHTML = list.length ? list.map(projectCard).join("") : `<p class="empty">Nothing here yet.</p>`;
        observeReveals();
        bindCursorTargets();
      });
    }
    el.innerHTML = projects.length
      ? projects.map(projectCard).join("")
      : `<p class="empty">Work coming soon.</p>`;
    observeReveals();
    bindCursorTargets();
  } catch {
    el.innerHTML = `<p class="empty">Couldn't load work right now.</p>`;
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
      wrap.innerHTML = `<p class="empty">Project not found. <a href="work.html" style="color:var(--blue)">Back to work →</a></p>`;
      return;
    }
    document.title = `${p.title} — Pixal Prompt`;

    let media = "";
    if (p.video_file_url) {
      media += `<video src="${p.video_file_url}" autoplay muted loop playsinline controls></video>`;
    }
    if (p.hero_url) {
      media += `<img src="${cdn(p.hero_url, 2000)}" alt="${p.title}">`;
    }
    if (p.video_embed_url) {
      media += `<div class="embed"><iframe src="${toEmbed(p.video_embed_url)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    }
    (p.gallery_urls || "")
      .split("|")
      .map((u) => u.trim())
      .filter(Boolean)
      .forEach((u) => {
        if (u.match(/\.(mp4|webm|mov)(\?|$)/i)) media += `<video src="${u}" muted loop playsinline controls></video>`;
        else media += `<img src="${cdn(u, 2000)}" alt="${p.title}" loading="lazy">`;
      });

    wrap.innerHTML = `
      <a class="back-link" href="work.html">← All work</a>
      <h1>${p.title}</h1>
      <div class="project-meta">
        <div><span class="label">Client</span>${p.client || "—"}</div>
        <div><span class="label">Year</span>${p.year || "—"}</div>
        <div><span class="label">Category</span>${p.category || "—"}</div>
        ${p.tags ? `<div><span class="label">Scope</span>${p.tags}</div>` : ""}
      </div>
      <p class="project-body">${p.description_long || p.description_short || ""}</p>
      <div class="media-stack">${media}</div>`;
  } catch {
    wrap.innerHTML = `<p class="empty">Couldn't load this project right now.</p>`;
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
      ? team
          .map(
            (t) => `
        <div class="team-card reveal">
          <img src="${cdn(t.photo_url, 800)}" alt="${t.name}" loading="lazy">
          <h3>${t.name}</h3>
          <p class="role">${t.role || ""}</p>
          <p class="bio">${t.bio_short || ""}</p>
          <div class="links">
            ${t.instagram ? `<a href="${t.instagram}" target="_blank" rel="noopener">Instagram</a>` : ""}
            ${t.linkedin ? `<a href="${t.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : ""}
          </div>
        </div>`
          )
          .join("")
      : `<p class="empty">Team coming soon.</p>`;
    observeReveals();
  } catch {
    el.innerHTML = `<p class="empty">Couldn't load team right now.</p>`;
  }
}

/* ---------- hero typing ---------- */
function typeHero() {
  const el = document.querySelector(".prompt-line .typed");
  if (!el) return;
  const text = el.dataset.text || "";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = text;
    return;
  }
  el.textContent = "";
  let i = 0;
  const tick = () => {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(tick, 38 + Math.random() * 50);
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
    t.addEventListener("mouseleave", () => {
      cursorEl.classList.remove("is-label");
    });
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
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initCursor();
  typeHero();
  observeReveals();
  renderFeatured("featured-grid");
  renderWorkGrid("work-grid", "work-filters");
  renderProject();
  renderTeam("team-grid");
});
