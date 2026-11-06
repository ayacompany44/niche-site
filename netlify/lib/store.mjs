import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

export const CATS = ["voyage", "enfance", "mode-de-vie", "amour", "carriere", "insolite", "plaisirs", "impossible"];
export const ID_RE = /^[a-z0-9-]{3,60}$/;
export const IG_RE = /^[A-Za-z0-9._]{1,30}$/;

export const store = () => getStore({ name: "niche", consistency: "strong" });

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
export const adminConfigured = () => !!env("ADMIN_PASSWORD");
export function isAdmin(req) {
  const pw = env("ADMIN_PASSWORD");
  const key = req.headers.get("x-admin-key") || "";
  if (!pw || !key) return false;
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(pw).digest();
  return timingSafeEqual(a, b);
}

export const summary = (d) => ({
  id: d.id,
  title: d.title,
  category: d.category,
  author: d.anonymous ? "" : d.author || "",
  anonymous: !!d.anonymous,
  excerpt: (d.story || "").slice(0, 220),
  publishedAt: d.publishedAt,
  featured: !!d.featured,
  example: !!d.example,
  photoCount: d.photoCount || 0,
});

/* Rêves d'exemple, signés par la rédaction et marqués « Exemple » sur le site.
   Ils permettent de lire le magazine dès la mise en ligne ; supprime-les depuis la modération. */
const SEED = [
  { id: "exemple-cinema", title: "Je veux posséder un petit cinéma.", category: "carriere",
    story: "Une seule salle, quarante fauteuils rouges, un projecteur qui ronronne.\n\nPas de pop-corn au caramel, juste des films qu'on n'a vus nulle part ailleurs et un panneau écrit à la main pour la séance du dimanche.\n\nC'est le genre de rêve qu'on garde pour soi parce qu'il n'a rien de raisonnable. C'est justement pour ça qu'il est là." },
  { id: "exemple-japon", title: "Je veux vivre un an au Japon.", category: "voyage",
    story: "Pas deux semaines entre Tokyo et Kyoto. Un an entier, avec un vrai appartement, un konbini en bas de chez soi et le temps de voir les quatre saisons.\n\nApprendre assez la langue pour commander sans montrer du doigt. Rentrer en sachant faire autre chose que des photos." },
  { id: "exemple-piece-secrete", title: "Je veux une maison avec une pièce secrète.", category: "enfance",
    story: "Une bibliothèque qui pivote. Derrière, une petite pièce sans fenêtre, juste une lampe, un fauteuil et des livres.\n\nPersonne n'a besoin de savoir qu'elle existe. C'est tout l'intérêt." },
  { id: "exemple-fleurerie", title: "Je veux ouvrir une fleurerie dans les montagnes.", category: "mode-de-vie",
    story: "Un village à 1 400 mètres, une boutique en bois, des bouquets de fleurs des champs et de chardons.\n\nFermé quand il neige trop. Ouvert quand quelqu'un frappe quand même." },
  { id: "exemple-train", title: "Je veux faire le tour du monde en train.", category: "voyage",
    story: "Paris, Moscou, Pékin, puis tout ce que les rails permettent. Regarder les paysages changer à la vitesse d'une fenêtre.\n\nPas d'avion, pas de raccourci. Juste le temps que ça prend." },
].map((d, i) => ({
  ...d, author: "La rédaction NICHE", instagram: "", anonymous: false, featured: i < 2, example: true, photoCount: 0,
  publishedAt: new Date(Date.UTC(2026, 10, 6, 9, i)).toISOString(),
}));

export async function getIndex(s) {
  let idx = await s.get("index", { type: "json" });
  if (!idx) {
    for (const d of SEED) await s.setJSON(`dream/${d.id}`, d);
    idx = { dreams: SEED.map(summary) };
    await s.setJSON("index", idx);
  }
  return idx;
}

/* Ajoute (ou met à jour) un rêve dans l'index public, en revérifiant après écriture
   pour ne pas perdre un rêve si deux personnes publient au même instant. */
export async function upsertIndex(s, dream) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const idx = await getIndex(s);
    idx.dreams = [summary(dream), ...idx.dreams.filter((d) => d.id !== dream.id)];
    await s.setJSON("index", idx);
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 200));
    const check = await s.get("index", { type: "json" });
    const mine = check?.dreams.find((d) => d.id === dream.id);
    if (mine && mine.featured === !!dream.featured && mine.title === dream.title) return;
  }
}

/* Remet dans l'index tout rêve publié qui n'y serait pas (filet de sécurité). */
export async function repairIndex(s) {
  const idx = await getIndex(s);
  const have = new Set(idx.dreams.map((d) => d.id));
  const { blobs } = await s.list({ prefix: "dream/" });
  let changed = false;
  for (const b of blobs) {
    const id = b.key.slice(6);
    if (have.has(id)) continue;
    const d = await s.get(b.key, { type: "json" });
    if (d) { idx.dreams.unshift(summary(d)); changed = true; }
  }
  if (changed) await s.setJSON("index", idx);
}

export async function deletePhotos(s, id, count) {
  for (let n = 0; n < (count || 6); n++) {
    await s.delete(`photo/${id}/${n}`);
    await s.delete(`photo/${id}/${n}-t`);
  }
}
