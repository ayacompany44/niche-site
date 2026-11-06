(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(pointer:fine)").matches;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
const ID_RE = /^[a-z0-9-]{3,60}$/;

const CATS = [
  {id:"voyage", label:"Voyage"}, {id:"enfance", label:"Rêves d'enfance"}, {id:"mode-de-vie", label:"Mode de vie"},
  {id:"amour", label:"Amour et relations"}, {id:"carriere", label:"Carrière et ambitions"}, {id:"insolite", label:"Rêves insolites"},
  {id:"plaisirs", label:"Petits plaisirs"}, {id:"impossible", label:"Rêves impossibles"}
];
const catLabel = id => (CATS.find(c => c.id === id) || {label:"Rêve"}).label;
const MONTHS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const photoUrl = (id, n, thumb) => `/api/photo/${encodeURIComponent(id)}/${n}${thumb ? "?s=thumb" : ""}`;

const S = { status:"loading", dreams:[], homeCat:"all", archCat:"all", q:"", sort:"new", photos:[], openedAt:0, adminKey:"", subs:[], modTab:"pending", confirm:null, full:{} };

/* ---------- API ---------- */
async function j(r) { const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || "Erreur réseau."), {status:r.status}); return d; }
const api = {
  list: () => fetch("/api/dreams").then(j),
  get: id => fetch("/api/dream/" + encodeURIComponent(id)).then(j),
  submit: body => fetch("/api/submit", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)}).then(j),
  admin: (action, data = {}) => fetch("/api/admin", {method:"POST", headers:{"content-type":"application/json", "x-admin-key":S.adminKey}, body:JSON.stringify({action, ...data})}).then(j)
};

/* ---------- lettres ---------- */
function split(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  el.setAttribute("aria-label", el.textContent.trim().replace(/\s+/g, " "));
  let i = 0;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
        [...part].forEach(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch; s.style.setProperty("--i", i++); w.appendChild(s); });
        frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) walk(n);
  });
  walk(el);
}
function replay(el) { if (RM) return; el.classList.remove("reveal"); void el.offsetWidth; el.classList.add("reveal"); }
$$("[data-split]").forEach(split);

// lettres qui s'élargissent au passage de la souris
if (FINE && !RM) {
  let mx = 0, my = 0, q = false;
  const frame = () => {
    q = false;
    $$(".kin").forEach(el => {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      $$(".ch", el).forEach(ch => {
        const b = ch.getBoundingClientRect();
        const f = Math.max(0, 1 - Math.hypot(b.left + b.width / 2 - mx, b.top + b.height / 2 - my) / 240);
        const e = f * f * (3 - 2 * f);
        ch.style.fontVariationSettings = e > .01 ? `"wdth" ${(100 + 25 * e).toFixed(1)}` : "";
      });
    });
  };
  addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; if (!q) { q = true; requestAnimationFrame(frame); } }, {passive:true});
}

/* ---------- toast ---------- */
let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2800); }

/* ---------- header + scroll ---------- */
const hdr = $("#hdr");
let lastY = scrollY, vel = 0;
function tone() {
  let t = "y";
  for (const el of $$("[data-tone]")) { if (el.closest("[hidden]")) continue; const r = el.getBoundingClientRect(); if (r.top <= 40 && r.bottom > 40) t = el.dataset.tone; }
  document.documentElement.style.setProperty("--hdr-fg", t === "k" ? "var(--y)" : "var(--k)");
  document.documentElement.style.setProperty("--hdr-bg", t === "k" ? "var(--k)" : "var(--y)");
}
const bands = $$("#stage .band");
function onScroll() {
  const y = scrollY; vel = vel * .8 + (y - lastY) * .2;
  if (y > 300 && y - lastY > 4) hdr.classList.add("hide"); else if (y < lastY) hdr.classList.remove("hide");
  lastY = y; tone();
  if (!RM && !$("#v-home").hidden) {
    const p = Math.min(1, y / (innerHeight * .9));
    bands.forEach((b, i) => b.style.transform = p > 0 ? `translateX(${((i % 2 ? 1 : -1) * p * (4 + i * 2)).toFixed(2)}%)` : "");
  }
}
addEventListener("scroll", () => requestAnimationFrame(onScroll), {passive:true});
setTimeout(() => $("#top").classList.remove("intro"), 1500);

/* ---------- marquee ---------- */
const marq = $("#marq"), track = marq && $(".track", marq);
let mx0 = 0, mw = 0;
function renderMarq() {
  if (!track) return;
  const items = S.dreams.length ? S.dreams.slice(0, 12).map(d => `<a class="item" href="#reve-${esc(d.id)}">${esc(d.title)}</a>`)
    : ["Everyone has a dream", "No dream is too niche"].map(t => `<span class="item">${t}</span>`);
  const h = items.join(""); track.innerHTML = h + h + h + h; mw = 0;
}
renderMarq();
if (!RM && track) (function loop() {
  if (!mw) mw = track.scrollWidth / 4;
  if (mw) { mx0 -= .55 + Math.min(8, Math.abs(vel)) * .3; if (mx0 <= -mw) mx0 += mw; track.style.transform = `translateX(${mx0.toFixed(1)}px)`; }
  vel *= .94; requestAnimationFrame(loop);
})();

/* ---------- cartes ---------- */
function card(d) {
  const who = d.anonymous || !d.author ? "Anonyme" : d.author;
  return `<a class="card" href="#reve-${esc(d.id)}">
    ${d.photoCount ? `<div class="ph" style="--ar:4/5"><img src="${photoUrl(d.id, 0, true)}" alt="" loading="lazy"></div>` : ""}
    <h3>${esc(d.title)}</h3>
    <span class="who">${esc(catLabel(d.category))} · ${esc(who)}${d.example ? " · Exemple" : ""}</span></a>`;
}
function stateBlock(kind) {
  if (S.status === "loading") return `<div class="empty"><span class="mono">Chargement…</span><h3>Les rêves arrivent.</h3></div>`;
  if (S.status === "error") return `<div class="empty"><span class="mono">Connexion impossible</span><h3>L'archive ne répond pas.</h3><p>Vérifie ta connexion, puis recharge la page.</p></div>`;
  if (kind === "filter") return `<div class="empty"><h3>Rien ici pour l'instant.</h3><p>Aucun rêve publié dans cette catégorie. Le premier pourrait être le tien.</p><a class="btn solid" href="#partager">+ Partager mon rêve NICHE</a></div>`;
  return `<div class="empty"><h3>Le magazine attend son premier rêve.</h3><p>Chaque rêve envoyé est relu puis publié ici.</p><a class="btn solid" href="#partager">+ Partager mon rêve NICHE</a></div>`;
}
function filters(active, target) {
  const used = new Set(S.dreams.map(d => d.category));
  return [`<button class="chip" data-f="${target}" data-cat="all" aria-pressed="${active === "all"}">Tous</button>`]
    .concat(CATS.filter(c => used.has(c.id) || active === c.id).map(c => `<button class="chip" data-f="${target}" data-cat="${c.id}" aria-pressed="${active === c.id}">${esc(c.label)}</button>`)).join("");
}
document.addEventListener("click", e => {
  const b = e.target.closest(".chip[data-f]"); if (!b) return;
  if (b.dataset.f === "home") { S.homeCat = b.dataset.cat; renderHome(); } else { S.archCat = b.dataset.cat; renderArchive(); }
});

/* ---------- accueil : anneau, rangée ---------- */
const VARIANTS = 5;
function fillers() { return ["No dream is too niche", "Everyone has a dream", "Raconte le tien", ...CATS.map(c => c.label)]; }
function renderRing() {
  const ring = $("#ring"); if (!ring) return;
  const small = innerWidth < 700;
  const N = small ? 12 : 16, R = small ? 250 : Math.min(720, innerWidth * .44);
  const dreams = S.dreams.length ? S.dreams : [];
  const fl = fillers();
  let html = "";
  for (let k = 0; k < N; k++) {
    const d = dreams.length && k % 2 === 0 ? dreams[(k / 2) % dreams.length] : null;
    const v = k % VARIANTS;
    const w = small ? 92 + (k % 3) * 14 : 120 + (k % 3) * 22, h = Math.round(w * (k % 4 === 1 ? 1 : 1.3));
    const style = `--w:${w}px;--h:${h}px;--fs:${small ? 13 : 17}px;transform:rotateY(${(360 / N) * k}deg) translateZ(${R}px)`;
    if (d) {
      const img = d.photoCount ? `<img src="${photoUrl(d.id, 0, true)}" alt="" loading="lazy">` : "";
      html += `<a class="rc ${img ? "v4" : "v" + v}" href="#reve-${esc(d.id)}" tabindex="-1" style="${style}">${img}<span class="m">${esc(catLabel(d.category))}</span><span class="t">${img ? "" : esc(d.title)}</span></a>`;
    } else {
      html += `<div class="rc v${v}" style="${style}"><span class="m">NICHE®</span><span class="t">${esc(fl[k % fl.length])}</span></div>`;
    }
  }
  ring.innerHTML = html;
}
let ringA = 0;
(function ringLoop() {
  const ring = $("#ring");
  if (ring && !$("#v-home").hidden) {
    if (!RM) ringA += .07;
    const lift = Math.min(1, scrollY / innerHeight);
    const base = innerWidth < 700 ? 16 : 9;
    ring.style.transform = `translateY(${(base - lift * 12).toFixed(2)}vh) rotateX(${(-17 - lift * 6).toFixed(2)}deg) rotateZ(-5deg) rotateY(${ringA.toFixed(2)}deg)`;
    const cards = ring.children, n = cards.length;
    for (let k = 0; k < n; k++) {
      const a = ((360 / n) * k + ringA) * Math.PI / 180;
      const front = (Math.cos(a) + 1) / 2;
      cards[k].style.opacity = (.22 + .78 * front).toFixed(2);
      cards[k].style.filter = front < .5 ? `brightness(${(.35 + front).toFixed(2)})` : "";
    }
  }
  requestAnimationFrame(ringLoop);
})();
const RAIL_W = [440, 300, 500, 440, 340, 520];
function renderRail() {
  const rail = $("#rail"); if (!rail) return;
  if (S.status !== "ok" || !S.dreams.length) { rail.innerHTML = `<div class="wrap" style="width:100%">${stateBlock(S.dreams.length ? "filter" : "empty")}</div>`; return; }
  const list = [...S.dreams.filter(d => d.featured), ...S.dreams.filter(d => !d.featured)].slice(0, 12);
  rail.innerHTML = list.map((d, i) => {
    const who = d.anonymous || !d.author ? "Anonyme" : d.author;
    const img = d.photoCount ? `<img src="${photoUrl(d.id, 0, true)}" alt="" loading="lazy">` : "";
    const cls = img ? "ph" : "v" + (i % 4);
    return `<a class="rd ${cls}" href="#reve-${esc(d.id)}" style="--w:${RAIL_W[i % RAIL_W.length]}px" draggable="false">${img}<span class="m mono"><span>${esc(catLabel(d.category))}</span><span>${d.example ? "Exemple" : esc(fmtDate(d.publishedAt))}</span></span><span class="t">${esc(d.title)}</span></a>`;
  }).join("") + `<a class="rd v2" href="#archive" style="--w:300px"><span class="m mono">Archive</span><span class="t">Tous les rêves →</span></a>`;
}
function renderHome() { renderRing(); renderRail(); }
// rangée : glisser à la souris
(() => {
  const rail = $("#rail"); if (!rail || !FINE) return;
  let down = false, sx = 0, sl = 0, moved = 0;
  rail.addEventListener("pointerdown", e => { if (e.button) return; down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft; });
  addEventListener("pointermove", e => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if (moved > 4) rail.classList.add("drag"); rail.scrollLeft = sl - dx; });
  addEventListener("pointerup", () => { down = false; rail.classList.remove("drag"); });
  rail.addEventListener("click", e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
})();
addEventListener("resize", () => { clearTimeout(window.__rz); window.__rz = setTimeout(renderRing, 200); });

/* ---------- phrase révélée au scroll ---------- */
(() => {
  const p = $("#stmt"); if (!p) return;
  const walk = (node, italic) => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span"); w.className = "wd" + (italic ? " it" : ""); w.textContent = part; frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) { const it = n.classList.contains("it"); n.replaceWith(...(() => { const f = document.createElement("span"); f.innerHTML = ""; walk(n, it); return [...n.childNodes]; })()); }
  });
  walk(p, false);
  const words = $$(".wd", p);
  const update = () => {
    if ($("#v-home").hidden) return;
    const r = p.getBoundingClientRect();
    const prog = RM ? 1 : Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35)));
    const lit = Math.round(prog * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < lit));
  };
  addEventListener("scroll", () => requestAnimationFrame(update), {passive:true});
  update();
})();

/* ---------- sphère de mots ---------- */
(() => {
  const cv = $("#sphere"); if (!cv) return;
  const ctx = cv.getContext("2d");
  const WORDS = ["rêve", "NICHE", "voyage", "Japon", "cinéma", "train", "montagne", "secret", "enfance", "amour", "rêve", "insolite", "NICHE", "plaisirs", "archive", "rêve", "impossible", "fleurs", "maison", "rêve", "monde", "NICHE", "été", "mer"];
  const pts = WORDS.map((w, i) => { const y = 1 - (i / (WORDS.length - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963; return {w, x: Math.cos(t) * r, y, z: Math.sin(t) * r}; });
  let a = 0, visible = true;
  new IntersectionObserver(es => visible = es[0].isIntersecting).observe(cv);
  function draw() {
    const W = cv.clientWidth, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, W);
    const R = W * .36, c = W / 2, ca = Math.cos(a), sa = Math.sin(a), tilt = -.35, ct = Math.cos(tilt), st = Math.sin(tilt);
    const pr = pts.map(p => { const x = p.x * ca - p.z * sa, z0 = p.x * sa + p.z * ca, y = p.y * ct - z0 * st, z = p.y * st + z0 * ct; return {w: p.w, x, y, z}; }).sort((m, n) => m.z - n.z);
    for (const p of pr) {
      const s = 1 / (1.9 - p.z * .7), f = (p.z + 1) / 2;
      ctx.font = `${p.w === "NICHE" ? 800 : 600} ${Math.round(W * .085 * s)}px Archivo, Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = p.w === "rêve" ? `rgba(225,255,0,${(.15 + .85 * f).toFixed(2)})` : `rgba(237,237,230,${(.08 + .92 * f).toFixed(2)})`;
      ctx.fillText(p.w, c + p.x * R * s * 1.4, c + p.y * R * s * 1.4);
    }
  }
  (function loop() { if (visible && !$("#v-home").hidden) { if (!RM) a += .006; draw(); } requestAnimationFrame(loop); })();
  if (document.fonts) document.fonts.ready.then(draw);
})();

/* ---------- archive ---------- */
const issue = d => { const asc = [...S.dreams].sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt))); return "N°" + String(asc.indexOf(d) + 1).padStart(4, "0"); };
function renderArchive() {
  $("#archFilters").innerHTML = filters(S.archCat, "arch");
  const q = S.q.trim().toLowerCase();
  const list = S.dreams.filter(d => (S.archCat === "all" || d.category === S.archCat) && (!q || [d.title, d.excerpt, d.author, catLabel(d.category)].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => (S.sort === "new" ? -1 : 1) * String(a.publishedAt).localeCompare(String(b.publishedAt)));
  const n = S.dreams.length;
  $("#archCount").textContent = n ? `${n} rêve${n > 1 ? "s" : ""} dans la bibliothèque` : "La bibliothèque des rêves";
  $("#idx").innerHTML = S.status !== "ok" || !list.length
    ? `<li style="border:0;padding-top:20px">${stateBlock(n ? "filter" : "empty")}</li>`
    : list.map(d => `<li><a href="#reve-${esc(d.id)}" data-id="${esc(d.id)}" style="grid-template-columns:minmax(0,1fr) auto"><span class="t">${esc(d.title)}</span><span class="r mono"><span>${esc(catLabel(d.category))}</span><span style="opacity:.6">${d.example ? "Exemple" : esc(fmtDate(d.publishedAt))}</span></span></a></li>`).join("");
}
$("#q").addEventListener("input", e => { S.q = e.target.value; renderArchive(); });
$("#sort").addEventListener("click", e => { S.sort = S.sort === "new" ? "old" : "new"; e.currentTarget.textContent = S.sort === "new" ? "Plus récents ↓" : "Plus anciens ↑"; renderArchive(); });
const peek = $("#peek"), peekImg = $("#peekImg");
if (FINE) {
  $("#idx").addEventListener("pointermove", e => {
    const a = e.target.closest("a[data-id]"); const d = a && S.dreams.find(x => x.id === a.dataset.id);
    if (d && d.photoCount) { const src = photoUrl(d.id, 0, true); if (peekImg.getAttribute("src") !== src) peekImg.src = src; peek.classList.add("on"); peek.style.left = e.clientX + 30 + "px"; peek.style.top = e.clientY + "px"; }
    else peek.classList.remove("on");
  });
  $("#idx").addEventListener("pointerleave", () => peek.classList.remove("on"));
}
function doSurprise() {
  const pool = S.dreams; if (!pool.length) { toast("L'archive est encore vide."); return; }
  const pick = pool[Math.random() * pool.length | 0];
  if (RM) { location.hash = "reve-" + pick.id; return; }
  const sh = $("#shuffle"), t = $("#shuffleT"); sh.hidden = false; let k = 0;
  const iv = setInterval(() => {
    t.textContent = k < 11 ? pool[Math.random() * pool.length | 0].title : pick.title;
    t.style.fontVariationSettings = k < 11 ? `"wdth" ${62 + Math.random() * 63 | 0}` : "";
    if (++k > 12) { clearInterval(iv); setTimeout(() => { location.hash = "reve-" + pick.id; setTimeout(() => sh.hidden = true, 420); }, 450); }
  }, 70);
}
$("#surprise").addEventListener("click", doSurprise);
$("#hdrSurprise").addEventListener("click", e => { e.preventDefault(); doSurprise(); });

/* ---------- page rêve ---------- */
let lbList = [], lbIdx = 0, dreamReq = 0;
async function renderDream(id) {
  const el = $("#dream"); const req = ++dreamReq;
  const sum = S.dreams.find(x => x.id === id);
  let d = S.full[id];
  if (!d) {
    el.innerHTML = `<div class="top mono"><a href="#archive">← Archive</a></div>${sum ? `<h1>${esc(sum.title)}</h1>` : `<div style="margin-top:30px">${stateBlock()}</div>`}`;
    if (!ID_RE.test(id)) { notFound(el); return; }
    try { d = (await api.get(id)).dream; S.full[id] = d; } catch (e) { if (req === dreamReq) notFound(el, e.status !== 404); return; }
    if (req !== dreamReq) return;
  }
  const asc = [...S.dreams].sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
  const pos = asc.findIndex(x => x.id === id), prev = asc[pos - 1], next = asc[pos + 1];
  const anon = d.anonymous || !d.author;
  const ig = !d.anonymous && IG_RE.test(d.instagram || "") ? d.instagram : "";
  let sim = S.dreams.filter(x => x.id !== id && x.category === d.category);
  if (sim.length < 3) sim = sim.concat(S.dreams.filter(x => x.id !== id && x.category !== d.category));
  sim = sim.slice(0, 3);
  const paras = (d.story || "").split(/\n+/).map(p => p.trim()).filter(Boolean);
  lbList = Array.from({length: d.photoCount || 0}, (_, n) => photoUrl(id, n));
  el.innerHTML = `
    <div class="top mono"><a href="#archive">← Archive</a><span>${sum ? issue(sum) : ""}</span><span>${esc(catLabel(d.category))}</span><span>${d.example ? "Exemple" : esc(fmtDate(d.publishedAt))}</span></div>
    <h1 class="split" id="dTitle">${esc(d.title)}</h1>
    <div class="who"><span>par ${esc(anon ? "un rêveur anonyme" : d.author)}</span>${ig ? `<a class="mono" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener">@${esc(ig)} ↗</a>` : ""}${d.example ? `<span class="mono badge" style="font-family:var(--mono);font-style:normal;font-size:12px">Rêve d'exemple</span>` : ""}</div>
    ${lbList.length ? `<div class="photos">${lbList.map((src, n) => `<button type="button" data-lb="${n}" aria-label="Agrandir la photo ${n + 1}"><img src="${src}" alt="Photo ${n + 1} du rêve" loading="${n ? "lazy" : "eager"}"></button>`).join("")}</div>` : ""}
    <div class="story">
      <div class="side mono"><span>${esc(catLabel(d.category))}</span>${d.example ? "" : `<span>Publié le ${esc(fmtDate(d.publishedAt))}</span>`}<button class="btn" id="copy" type="button">Copier le lien</button></div>
      <div class="txt">${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>
    </div>
    ${sim.length ? `<div class="more"><span class="mono">Rêves similaires</span><ul class="sim" style="margin-top:14px">${sim.map(x => `<li><a href="#reve-${esc(x.id)}"><span class="t">${esc(x.title)}</span><span class="mono">${esc(catLabel(x.category))}</span></a></li>`).join("")}</ul></div>` : ""}
    <nav class="pn" aria-label="Autres rêves">
      ${prev ? `<a href="#reve-${esc(prev.id)}"><span class="mono">← Précédent</span><span class="t">${esc(prev.title)}</span></a>` : `<a href="#archive"><span class="mono">← Retour</span><span class="t">L'archive</span></a>`}
      ${next ? `<a href="#reve-${esc(next.id)}"><span class="mono">Suivant →</span><span class="t">${esc(next.title)}</span></a>` : `<a href="#partager"><span class="mono">À toi →</span><span class="t">Partager mon rêve NICHE</span></a>`}
    </nav>`;
  const h = $("#dTitle"); split(h); replay(h);
  $("#copy").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Lien copié."); }
    catch { toast(location.href); }
  };
}
function notFound(el, network) {
  el.innerHTML = `<div class="top mono"><a href="#archive">← Archive</a></div><h1>${network ? "Connexion impossible." : "Ce rêve est introuvable."}</h1><p style="max-width:50ch;margin-top:20px">${network ? "Vérifie ta connexion puis réessaie." : "Il a peut-être été retiré, ou le lien est incomplet."}</p><p><a class="btn solid" href="#archive">Retour à l'archive</a></p>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-lb]"); if (b) { lbIdx = +b.dataset.lb; openLb(); } });
function openLb() {
  let lb = $("#lb");
  if (!lb) {
    lb = document.createElement("div"); lb.id = "lb"; lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "Photo agrandie");
    lb.innerHTML = `<img alt=""><button class="x mono" type="button">Fermer ✕</button><div class="nav mono"><button type="button" data-d="-1">← Préc.</button><span></span><button type="button" data-d="1">Suiv. →</button></div>`;
    document.body.appendChild(lb);
    lb.addEventListener("click", e => { const d = e.target.closest("[data-d]"); if (d) { lbIdx = (lbIdx + +d.dataset.d + lbList.length) % lbList.length; paintLb(); } else if (e.target === lb || e.target.closest(".x")) lb.remove(); });
  }
  paintLb(); $(".x", lb).focus();
}
function paintLb() { const lb = $("#lb"); if (!lb) return; $("img", lb).src = lbList[lbIdx]; $(".nav span", lb).textContent = `${lbIdx + 1} / ${lbList.length}`; $(".nav", lb).hidden = lbList.length < 2; }
addEventListener("keydown", e => {
  if (e.key === "Escape") { if ($("#lb")) $("#lb").remove(); else if (!share.hidden) closeShare(); }
  if ($("#lb") && /Arrow(Left|Right)/.test(e.key)) { lbIdx = (lbIdx + (e.key === "ArrowRight" ? 1 : -1) + lbList.length) % lbList.length; paintLb(); }
});

/* ---------- routeur ---------- */
let cur = null, curArg = null, back = "";
function parse() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === "archive") return ["archive"];
  if (h.startsWith("reve-")) return ["dream", h.slice(5)];
  if (h === "partager") return ["share"];
  if (h === "confidentialite") return ["privacy"];
  if (h === "moderation") return ["moderation"];
  if (h === "explorer" || h === "concept") return ["home", h];
  return ["home", null];
}
function show(view, arg) {
  ["home", "archive", "dream", "privacy", "moderation"].forEach(v => $("#v-" + v).hidden = v !== view);
  if (view === "home") renderHome();
  if (view === "archive") renderArchive();
  if (view === "dream") renderDream(arg);
  if (view === "moderation") renderMod();
  $$("[data-nav]").forEach(a => a.toggleAttribute("aria-current", a.dataset.nav === (view === "home" ? arg : view)));
  if (view === "home" && arg) { const t = $("#" + arg); if (t) t.scrollIntoView(); } else scrollTo(0, 0);
  hdr.classList.remove("hide"); tone(); onScroll();
}
async function wipe(fn) {
  const w = $("#wipe");
  if (RM || !w.animate) { fn(); return; }
  await w.animate([{transform:"translateY(100%)"}, {transform:"translateY(0)"}], {duration:380, easing:"cubic-bezier(.7,0,.2,1)", fill:"forwards"}).finished.catch(() => {});
  fn();
  await w.animate([{transform:"translateY(0)"}, {transform:"translateY(-100%)"}], {duration:480, easing:"cubic-bezier(.7,0,.2,1)", fill:"forwards"}).finished.catch(() => {});
  w.style.transform = "translateY(100%)";
}
function route(first) {
  const [view, arg] = parse();
  if (view === "share") { if (!cur) { cur = "home"; show("home"); } openShare(); return; }
  if (!share.hidden) closeShare(true);
  back = location.hash;
  if (view === "home" && cur === "home" && !first) {
    curArg = arg; const t = arg ? $("#" + arg) : null;
    if (t) t.scrollIntoView({behavior: RM ? "auto" : "smooth"}); else if (!arg) scrollTo({top:0, behavior: RM ? "auto" : "smooth"});
    $$("[data-nav]").forEach(a => a.toggleAttribute("aria-current", a.dataset.nav === arg));
    return;
  }
  const same = view === cur && arg === curArg;
  cur = view; curArg = arg;
  if (first || same) show(view, arg); else wipe(() => show(view, arg));
}
addEventListener("hashchange", () => route(false));

/* ---------- formulaire ---------- */
const share = $("#share");
const F = { title:$("#f-title"), story:$("#f-story"), name:$("#f-name"), ig:$("#f-ig"), anon:$("#f-anon") };
$("#cats").innerHTML = CATS.map(c => `<label><input type="radio" name="cat" value="${c.id}"><span>${esc(c.label)}</span></label>`).join("");
function openShare() {
  if (!share.hidden) return;
  share.hidden = false; document.body.classList.add("share-open"); document.documentElement.style.overflow = "hidden";
  share.classList.remove("enter"); void share.offsetWidth; if (!RM) share.classList.add("enter");
  if (!S.openedAt) S.openedAt = Date.now();
  replay($("#shareTitle")); prog();
  setTimeout(() => F.title.focus({preventScroll:true}), RM ? 0 : 650);
}
function closeShare(fromRoute) {
  share.hidden = true; document.body.classList.remove("share-open"); document.documentElement.style.overflow = "";
  if (share.classList.contains("done")) { share.classList.remove("done"); $("#formView").hidden = false; $("#doneView").hidden = true; }
  if (!fromRoute) { if (back && back !== "#partager") location.hash = back; else history.replaceState(null, "", location.pathname + location.search); }
}
$("#closeShare").onclick = () => closeShare(false);
function prog() {
  const n = [F.title.value.trim().length > 2, F.story.value.trim().length >= 30, S.photos.length > 0, !!$("input[name=cat]:checked"), !!F.name.value.trim() || F.anon.checked, $("#c-text").checked && $("#c-priv").checked].filter(Boolean).length;
  $("#prog").style.setProperty("--p", (n / 6).toFixed(3));
}
F.title.addEventListener("input", () => { $("#c-title").textContent = `${F.title.value.length} / 110`; $("#e-title").hidden = true; prog(); });
F.story.addEventListener("input", () => { $("#c-story").textContent = `${F.story.value.length} / 5000`; $("#e-story").hidden = true; prog(); });
F.ig.addEventListener("input", () => { F.ig.value = F.ig.value.replace(/^@+/, "").trim(); $("#e-ig").hidden = true; });
F.name.addEventListener("input", prog);
F.anon.addEventListener("change", () => { $("#anonLbl").textContent = F.anon.checked ? "Publication anonyme" : "Mon nom sera visible"; prog(); });
share.addEventListener("change", e => { if (e.target.name === "cat") $("#e-cat").hidden = true; if (e.target.type === "checkbox") $("#e-consent").hidden = true; prog(); });

// photos : redimensionnées et compressées dans le navigateur
const MAX_PHOTOS = 6, MAX_BYTES = 15 * 1024 * 1024, OK = ["image/jpeg", "image/png", "image/webp"];
const bitmap = f => (window.createImageBitmap ? createImageBitmap(f).catch(() => viaImg(f)) : viaImg(f));
const viaImg = f => new Promise((res, rej) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { res(im); URL.revokeObjectURL(u); }; im.onerror = () => { rej(); URL.revokeObjectURL(u); }; im.src = u; });
function encode(src, max, qs, limit) {
  let sc = Math.min(1, max / Math.max(src.width, src.height));
  for (let pass = 0; pass < 5; pass++) {
    const w = Math.max(1, Math.round(src.width * sc)), h = Math.max(1, Math.round(src.height * sc));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);
    for (const q of qs) { const u = c.toDataURL("image/jpeg", q); if (u.length <= limit) return u; }
    sc *= .8;
  }
  throw new Error("trop lourde");
}
async function addFiles(files) {
  const errs = [];
  for (const f of files) {
    if (S.photos.length >= MAX_PHOTOS) { errs.push(`6 photos maximum : « ${f.name} » n'a pas été ajoutée.`); continue; }
    if (!OK.includes(f.type)) { errs.push(`« ${f.name} » : format non accepté (JPG, PNG ou WEBP).`); continue; }
    if (f.size > MAX_BYTES) { errs.push(`« ${f.name} » dépasse 15 Mo.`); continue; }
    const p = {key:Math.random().toString(36).slice(2), name:f.name, loading:true}; S.photos.push(p); thumbs();
    try {
      const bm = await bitmap(f);
      p.full = encode(bm, 1600, [.82, .74, .66, .58, .5], 500000);
      p.thumb = encode(bm, 560, [.74, .64, .54], 100000);
      p.loading = false; if (bm.close) bm.close();
    } catch { S.photos = S.photos.filter(x => x !== p); errs.push(`« ${f.name} » n'a pas pu être lue. Essaie une autre photo.`); }
    thumbs();
  }
  const er = $("#e-photos"); er.hidden = !errs.length; er.textContent = errs.join(" "); prog();
}
function thumbs() {
  $("#thumbs").innerHTML = S.photos.map(p => `<div class="thumb">${p.thumb ? `<img src="${p.thumb}" alt="${esc(p.name)}">` : ""}${p.loading ? `<div class="ld mono">…</div>` : `<button type="button" class="rm" data-rm="${p.key}" aria-label="Retirer ${esc(p.name)}">×</button>`}</div>`).join("");
  $("#c-img-row").hidden = !S.photos.length;
}
thumbs();
$("#f-photos").addEventListener("change", e => { addFiles([...e.target.files]); e.target.value = ""; });
$("#thumbs").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (!b) return; S.photos = S.photos.filter(p => p.key !== b.dataset.rm); thumbs(); prog(); });
const drop = $("#drop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => addFiles([...(e.dataTransfer?.files || [])]));

$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  const title = F.title.value.trim(), story = F.story.value.trim(), cat = $("input[name=cat]:checked")?.value || "", ig = F.ig.value.trim().replace(/^@+/, "");
  let first = null;
  const fail = (id, el) => { $(id).hidden = false; first = first || el; };
  if (title.length < 3) fail("#e-title", F.title);
  if (story.length < 30) fail("#e-story", F.story);
  if (!cat) fail("#e-cat", $("#cats"));
  if (ig && !IG_RE.test(ig)) fail("#e-ig", F.ig);
  const miss = [];
  if (!$("#c-text").checked) miss.push("la publication du texte");
  if (S.photos.length && !$("#c-img").checked) miss.push("la publication des photos");
  if (!$("#c-priv").checked) miss.push("la politique de confidentialité");
  if (miss.length) { $("#e-consent").textContent = "Coche : " + miss.join(", ") + "."; fail("#e-consent", $("#c-text")); }
  if (S.photos.some(p => p.loading)) { $("#e-photos").textContent = "Attends la fin du traitement des photos."; fail("#e-photos", drop); }
  if (first) { first.scrollIntoView({behavior: RM ? "auto" : "smooth", block:"center"}); return; }
  const btn = $("#send"), es = $("#e-send"); es.hidden = true; btn.disabled = true; btn.textContent = "Envoi en cours…";
  try {
    const res = await api.submit({ title, story, category:cat, author:F.name.value.trim(), instagram:ig, anonymous:F.anon.checked,
      consentText:true, consentPhotos:$("#c-img").checked, consentPrivacy:true, website:$("#f-website").value,
      elapsed: Date.now() - S.openedAt, photos:S.photos.map(p => ({full:p.full, thumb:p.thumb})) });
    $("#form").reset(); S.photos = []; thumbs(); $("#c-title").textContent = "0 / 110"; $("#c-story").textContent = "0 / 5000"; $("#anonLbl").textContent = "Mon nom sera visible"; prog();
    done(res);
    if (res && res.status === "published") load();
  } catch (err) {
    es.textContent = err.status ? err.message : "L'envoi n'a pas abouti. Vérifie ta connexion et réessaie : ton texte est toujours là.";
    es.hidden = false;
  } finally { btn.disabled = false; btn.textContent = "Envoyer mon rêve →"; }
});
function done(res) {
  share.classList.add("done"); $("#formView").hidden = true;
  const d = $("#doneView"); d.hidden = false;
  const live = res && res.status === "published" && ID_RE.test(res.id || "");
  d.innerHTML = `<section class="done-box wrap"><span class="mono">${live ? "Publié · en ligne maintenant" : "Bien reçu · relecture avant publication"}</span><h2 id="doneT">Ton rêve a trouvé <span class="it">sa place.</span></h2><p>${live ? "Merci de nous avoir confié une petite partie de ton univers." : "Il contient des mots que l'on relit avant de publier. Il apparaîtra dès qu'il sera validé."}</p><span class="slogan">No dream is too niche.</span>
    <div style="display:flex;gap:12px;flex-wrap:wrap">${live ? `<a class="btn solid" href="#reve-${esc(res.id)}">Voir mon rêve →</a><a class="btn" href="#archive">Explorer l'archive</a>` : `<a class="btn solid" href="#archive">Explorer l'archive</a>`}<button class="btn" type="button" id="again">Partager un autre rêve</button></div></section>`;
  const t = $("#doneT"); split(t); replay(t);
  $("#again").onclick = () => { share.classList.remove("done"); $("#formView").hidden = false; d.hidden = true; S.openedAt = Date.now(); share.scrollTo(0, 0); };
  share.scrollTo(0, 0);
}

/* ---------- modération ---------- */
try { S.adminKey = sessionStorage.getItem("niche-admin") || ""; } catch {}
async function renderMod() {
  const box = $("#mod");
  if (!S.adminKey) {
    box.innerHTML = `<form class="login" id="login"><label class="sr" for="pw">Mot de passe</label><input type="password" id="pw" placeholder="Mot de passe" autocomplete="current-password"><button class="btn solid" type="submit">Entrer</button></form><p class="err" id="loginErr" hidden style="margin-top:14px"></p>`;
    $("#login").onsubmit = async e => {
      e.preventDefault(); S.adminKey = $("#pw").value;
      try { await api.admin("login"); try { sessionStorage.setItem("niche-admin", S.adminKey); } catch {} renderMod(); }
      catch (err) { S.adminKey = ""; const le = $("#loginErr"); le.textContent = err.message; le.hidden = false; }
    };
    return;
  }
  box.innerHTML = `<p class="mono">Chargement…</p>`;
  try { S.subs = (await api.admin("pending")).subs; } catch (err) { if (err.status === 401) { logout(); return; } box.innerHTML = `<p class="err">${esc(err.message)}</p>`; return; }
  paintMod();
}
function logout() { S.adminKey = ""; try { sessionStorage.removeItem("niche-admin"); } catch {} renderMod(); }
function paintMod() {
  const box = $("#mod"), tab = S.modTab;
  const tabs = `<div class="tabs"><button class="chip" data-tab="pending" aria-pressed="${tab === "pending"}">Mis de côté (${S.subs.length})</button><button class="chip" data-tab="pub" aria-pressed="${tab === "pub"}">Publiés (${S.dreams.length})</button><button class="chip" data-tab="out">Se déconnecter</button></div>`;
  let body;
  if (tab === "pending") body = S.subs.length ? S.subs.map(s => `<div class="mod-item" data-id="${esc(s.id)}">
      <div style="min-width:0"><div class="kv mono"><span>${esc(catLabel(s.category))}</span><span>Reçu le ${esc(fmtDate(s.createdAt))}</span><span>${s.anonymous ? "Anonyme" : esc(s.author || "Sans nom")}${!s.anonymous && s.instagram ? " · @" + esc(s.instagram) : ""}</span><span>${s.photoCount} photo(s)</span>${s.flagged && s.flagged.length ? `<span class="badge" style="color:var(--y)">Mots repérés : ${esc(s.flagged.join(", "))}</span>` : ""}</div>
      <h3>${esc(s.title)}</h3><p class="st">${esc(s.story)}</p><div class="pics" data-pics="${s.photoCount}"></div></div>
      <div class="acts"><button class="btn solid" data-act="approve" type="button">Publier</button><button class="btn" data-act="approve-feat" type="button">Publier à la une</button><button class="btn" data-act="reject" type="button">${S.confirm === s.id ? "Confirmer le refus" : "Refuser"}</button></div></div>`).join("")
    : `<div class="empty"><h3>Rien de mis de côté.</h3><p>Les rêves publiés passent directement en ligne. Ceux qui contiennent des mots vulgaires arrivent ici, et tu choisis de les publier ou non.</p></div>`;
  else body = S.dreams.length ? S.dreams.map(d => `<div class="mod-item" data-id="${esc(d.id)}">
      <div style="min-width:0"><div class="kv mono"><span>${esc(catLabel(d.category))}</span><span>${esc(fmtDate(d.publishedAt))}</span>${d.example ? `<span class="badge">Exemple</span>` : ""}${d.featured ? `<span class="badge">À la une</span>` : ""}</div><h3><a href="#reve-${esc(d.id)}" style="text-decoration:none">${esc(d.title)}</a></h3></div>
      <div class="acts"><button class="btn" data-act="feature" type="button">${d.featured ? "Retirer de la une" : "Mettre à la une"}</button><button class="btn" data-act="remove" type="button">${S.confirm === d.id ? "Confirmer le retrait" : "Retirer du site"}</button></div></div>`).join("")
    : `<div class="empty"><h3>Aucun rêve publié.</h3></div>`;
  box.innerHTML = tabs + body;
  // vignettes des envois en attente (requête authentifiée)
  $$("[data-pics]", box).forEach(async el => {
    const id = el.closest("[data-id]").dataset.id;
    for (let n = 0; n < +el.dataset.pics; n++) {
      try { const r = await fetch(photoUrl(id, n, true), {headers:{"x-admin-key":S.adminKey}}); if (!r.ok) continue; const img = new Image(); img.alt = ""; img.src = URL.createObjectURL(await r.blob()); el.appendChild(img); } catch {}
    }
  });
}
$("#mod").addEventListener("click", async e => {
  const t = e.target.closest("[data-tab]");
  if (t) { if (t.dataset.tab === "out") { logout(); return; } S.modTab = t.dataset.tab; S.confirm = null; paintMod(); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const id = b.closest("[data-id]").dataset.id, act = b.dataset.act;
  if ((act === "reject" || act === "remove") && S.confirm !== id) { S.confirm = id; paintMod(); return; }
  S.confirm = null; b.disabled = true;
  try {
    if (act === "approve" || act === "approve-feat") { await api.admin("approve", {id, featured: act === "approve-feat"}); toast("Rêve publié."); }
    if (act === "reject") { await api.admin("reject", {id}); toast("Rêve refusé et supprimé."); }
    if (act === "feature") await api.admin("feature", {id});
    if (act === "remove") { await api.admin("remove", {id}); delete S.full[id]; toast("Rêve retiré du site."); }
    await load(); renderMod();
  } catch (err) { if (err.status === 401) logout(); else { toast(err.message); paintMod(); } }
});

/* ---------- chargement ---------- */
async function load() {
  try { S.dreams = (await api.list()).dreams; S.status = "ok"; }
  catch { if (S.status !== "ok") S.status = "error"; }
  renderMarq();
  if (cur === "home") renderHome();
  if (cur === "archive") renderArchive();
}
route(true);
load().then(() => { if (cur === "dream") renderDream(curArg); });
})();
