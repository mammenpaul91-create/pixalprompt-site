/* ============================================================
   PIXAL PROMPT — data engine (LATENT v1)
   Google-Sheets-driven content. Engine functions ported verbatim
   (parser, fetchers, placeholder fallback, cdn, embed normaliser,
   team center-reorder, ?cat= deep link). Only the emitted markup
   is LATENT. Experience layer: js/latent.js · WebGL: js/gl.js.
   ============================================================ */

/* ----------------- CONFIG — edit these ----------------- */
const CONFIG = {
  SHEET_ID: "1uQx6yNFHM7pPo7lsjJ4qNgJgOKEs5tE_hUWrOAcyehU",
  EMAIL: "pixalprompt@gmail.com",
  INSTAGRAM: "https://instagram.com/pixalprompt",
  TEASER_MEDIA: "https://res.cloudinary.com/pixalprompt/image/upload/v1781255390/plate-profile_pu7r9v.png",
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

/* ---------- LATENT media block: real <img> is the fallback,
              js/gl.js promotes it to a dissolve plane ---------- */
function mediaBlock(src, alt) {
  return `<div class="media" data-plane><img class="plane" src="${src}" alt="${alt}" loading="lazy" crossorigin="anonymous"></div>`;
}

/* ---------- shared afterRender hook ---------- */
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
  "signal pulled from noise.",
  "same models. different hands.",
  "rendered with intention, not iteration counts.",
  "the brief asked for safe. we declined.",
  "taste is the only parameter that matters.",
  "converged slowly, on purpose.",
];
function subFor(p, i) {
  if (p.description_short && !p.description_short.includes("One-line")) return p.description_short;
  return SUBTEXT_POOL[i % SUBTEXT_POOL.length];
}

function projectCard(p, i = 0) {
  const n = String(i + 1).padStart(3, "0");
  return `
    <a class="card" href="project.html?id=${encodeURIComponent(p.id)}" data-cursor="view">
      <span class="idx">[ ${n} ]</span>
      ${mediaBlock(imgSrc(p.thumbnail_url, p.id + "-thumb", 1400), p.title)}
      <div class="cap">
        <span class="tag">[ ${(p.category || "work").toLowerCase()}${p.year ? " · " + p.year : ""} ]</span>
        <h3 data-scramble>${p.title}</h3>
        <p class="sub">${subFor(p, i)}</p>
      </div>
    </a>`;
}

async function renderFeatured(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    const all = await getProjects();
    const projects = all.filter((p) => p.featured === "yes").slice(0, 6);
    el.innerHTML = projects.length
      ? projects.map((p, i) => projectCard(p, i)).join("")
      : `<p class="empty">work coming soon.</p>`;
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
    const show = (cat) => {
      const list = cat === "All" ? projects : projects.filter((p) => p.category === cat);
      el.innerHTML = list.length ? list.map((p, i) => projectCard(p, i)).join("") : `<p class="empty">nothing here yet.</p>`;
      afterRender();
    };
    const deepCat = new URLSearchParams(location.search).get("cat");
    const startCat = deepCat && cats.includes(deepCat) ? deepCat : "All";
    if (filtersEl) {
      filtersEl.innerHTML = cats.map((c) => `<button class="${c === startCat ? "active" : ""}" data-cat="${c}">${c.toLowerCase()}</button>`).join("");
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
      wrap.innerHTML = `<p class="empty">this render never converged. <a href="work.html">back to the feed →</a></p>`;
      return;
    }
    document.title = `${p.title} — Pixal Prompt`;

    let media = "";
    if (isRealUrl(p.video_file_url)) {
      media += `<div class="media"><video src="${p.video_file_url}" autoplay muted loop playsinline controls></video></div>`;
    }
    media += mediaBlock(imgSrc(p.hero_url, p.id + "-hero", 2000), p.title);
    if (isRealUrl(p.video_embed_url)) {
      media += `<div class="embed"><iframe src="${toEmbed(p.video_embed_url)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    }
    (p.gallery_urls || "")
      .split("|").map((u) => u.trim()).filter(Boolean)
      .forEach((u, i) => {
        if (u.match(/\.(mp4|webm|mov)(\?|$)/i)) media += `<div class="media"><video src="${u}" muted loop playsinline controls></video></div>`;
        else media += mediaBlock(imgSrc(u, p.id + "-g" + i, 2000), p.title);
      });

    wrap.innerHTML = `
      <a class="back-link" href="work.html">← back to the feed</a>
      <h1 data-scramble>${p.title}</h1>
      <div class="project-meta">
        <div><span class="label">client</span>${p.client || "—"}</div>
        <div><span class="label">year</span>${p.year || "—"}</div>
        <div><span class="label">category</span>${p.category || "—"}</div>
        ${p.tags ? `<div><span class="label">scope</span>${p.tags}</div>` : ""}
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
        <div class="team-card">
          ${mediaBlock(imgSrc(t.photo_url, "team-" + t.name, 800), t.name)}
          <h3 data-scramble>${t.name}</h3>
          <p class="role">[ ${(t.role || "").toLowerCase()} ]</p>
          <p class="bio">${t.bio_short || ""}</p>
          <div class="links">
            ${isRealUrl(t.instagram) ? `<a href="${t.instagram}" target="_blank" rel="noopener" data-cursor="open">instagram</a>` : ""}
            ${isRealUrl(t.linkedin) ? `<a href="${t.linkedin}" target="_blank" rel="noopener" data-cursor="open">linkedin</a>` : ""}
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
      el.innerHTML = `<p class="empty">rendering — add rows to the "Simonelle" tab in the sheet.</p>`;
      return;
    }
    el.innerHTML = items.map((r, i) => {
      const n = String(i + 1).padStart(3, "0");
      const isVideo = r.media_url.match(/\.(mp4|webm|mov)(\?|$)/i);
      const media = isVideo
        ? `<div class="media"><video src="${r.media_url}" muted loop playsinline autoplay></video></div>`
        : mediaBlock(cdn(r.media_url, 1400), r.caption || "Life with Simonelle");
      return `
        <div class="card">
          <span class="idx">[ ${n} ]</span>
          ${media}
          <div class="cap">
            <span class="tag">[ digital reflection${r.date ? " · " + r.date : ""} ]</span>
            ${r.brand ? `<h3 data-scramble>${r.brand}</h3>` : ""}
            ${r.caption ? `<p class="sub">${r.caption}</p>` : ""}
          </div>
        </div>`;
    }).join("");
    afterRender();
  } catch {
    el.innerHTML = `<p class="empty">rendering — add a "Simonelle" tab to the sheet.</p>`;
  }
}

/* ---------- chrome driven by CONFIG ---------- */
function initChrome() {
  const btn = document.querySelector(".menu-btn");
  const nav = document.querySelector("header nav");
  if (btn && nav) {
    btn.addEventListener("click", () => {
      nav.classList.toggle("open");
      btn.textContent = nav.classList.contains("open") ? "[ close ]" : "[ menu ]";
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
  const teaser = document.querySelector("[data-teaser] img");
  if (teaser) teaser.src = cdn(CONFIG.TEASER_MEDIA, 2000);
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  renderFeatured("feed-track");
  renderWorkGrid("work-grid", "work-filters");
  renderProject();
  renderTeam("team-grid");
  renderSimonelle("simonelle-grid");
});
