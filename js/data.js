/* ============================================================
   PIXAL PROMPT — data engine v14
   Google-Sheets-driven content. Ported verbatim from v13 site.js
   (parser, fetchers, renderers, placeholder fallback, cdn(),
   embed normaliser, team center-reorder).
   Experience layer lives in js/app.js — this file only fetches
   and renders, then calls PP.afterRender().
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

/* ---------- shared afterRender hook (experience layer binds here) ---------- */
function afterRender() {
  if (window.PP && window.PP.afterRender) window.PP.afterRender();
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
    const show = (cat) => {
      const list = cat === "All" ? projects : projects.filter((p) => p.category === cat);
      el.innerHTML = list.length ? list.map((p, i) => projectCard(p, i)).join("") : `<p class="empty">nothing here yet.</p>`;
      afterRender();
    };
    // ?cat= deep link (rows 01–03 on the index arrive pre-filtered)
    const deepCat = new URLSearchParams(location.search).get("cat");
    const startCat = deepCat && cats.includes(deepCat) ? deepCat : "All";
    if (filtersEl) {
      filtersEl.innerHTML = cats.map((c) => `<button class="${c === startCat ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
      filtersEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        filtersEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        show(btn.dataset.cat);
      });
    }
    show(startCat);
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

/* ---------- nav / footer chrome driven by CONFIG ---------- */
function initChrome() {
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
  initChrome();
  renderFeatured("featured-grid");
  renderWorkGrid("work-grid", "work-filters");
  renderProject();
  renderTeam("team-grid");
  renderSimonelle("simonelle-grid");
});
