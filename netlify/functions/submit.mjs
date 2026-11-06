import { store, json, CATS, IG_RE, upsertIndex } from "../lib/store.mjs";
import { findProfanity } from "../lib/filter.mjs";

const MAX_BODY = 5_500_000;      // limite Netlify : 6 Mo par requête
const MAX_PHOTOS = 6;
const MAX_FULL = 400_000;        // octets par photo (déjà compressée côté navigateur)
const MAX_THUMB = 80_000;

const clean = (v, max) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);

function decodeJpeg(dataUrl, max) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 100 || buf.length > max) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null; // signature JPEG
  return buf;
}

// POST /api/submit — un nouveau rêve : publié tout de suite s'il n'a ni photo ni vulgarité ; sinon → modération
export default async (req) => {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json({ error: "Envoi trop lourd. Retire une ou deux photos." }, 413);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Envoi illisible." }, 400); }

  // anti-spam : champ piège + temps de remplissage minimum
  if (b.website) return json({ ok: true });
  if (Number(b.elapsed || 0) < 4000) return json({ error: "Envoi trop rapide. Réessaie dans quelques secondes." }, 429);

  const title = clean(b.title, 110);
  const story = clean(b.story, 5000);
  const category = clean(b.category, 30);
  const author = clean(b.author, 40);
  const instagram = clean(b.instagram, 31).replace(/^@+/, "");
  const anonymous = !!b.anonymous;
  const photosIn = Array.isArray(b.photos) ? b.photos.slice(0, MAX_PHOTOS + 1) : [];

  if (title.length < 3) return json({ error: "Le titre du rêve est trop court." }, 400);
  if (story.length < 30) return json({ error: "Raconte ton rêve en quelques phrases (30 caractères minimum)." }, 400);
  if (!CATS.includes(category)) return json({ error: "Catégorie inconnue." }, 400);
  if (instagram && !IG_RE.test(instagram)) return json({ error: "Nom Instagram invalide." }, 400);
  if (!b.consentText || !b.consentPrivacy) return json({ error: "Les autorisations de publication sont obligatoires." }, 400);
  if (photosIn.length > MAX_PHOTOS) return json({ error: "6 photos maximum." }, 400);
  if (photosIn.length && !b.consentPhotos) return json({ error: "Autorise la publication de tes photos, ou retire-les." }, 400);

  const photos = [];
  for (const p of photosIn) {
    const full = decodeJpeg(p?.full, MAX_FULL), thumb = decodeJpeg(p?.thumb, MAX_THUMB);
    if (!full || !thumb) return json({ error: "Une des photos n'a pas un format accepté." }, 400);
    photos.push({ full, thumb });
  }

  const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const s = store();
  for (let n = 0; n < photos.length; n++) {
    await s.set(`photo/${id}/${n}`, photos[n].full);
    await s.set(`photo/${id}/${n}-t`, photos[n].thumb);
  }
  const createdAt = new Date().toISOString();
  const flagged = findProfanity(title, story, author, instagram);

  if (flagged.length || photos.length) {
    const reason = flagged.length ? "words" : "photos";
    await s.setJSON(`sub/${id}`, {
      id, title, story, category, author, instagram, anonymous, flagged, reason,
      consentText: true, consentPhotos: photos.length > 0, consentPrivacy: true,
      photoCount: photos.length, createdAt,
    });
    return json({ ok: true, id, status: "pending", reason }, 201);
  }

  const dream = {
    id, title, story, category,
    author: anonymous ? "" : author, instagram: anonymous ? "" : instagram, anonymous,
    photoCount: photos.length, featured: false, example: false,
    submittedAt: createdAt, publishedAt: createdAt,
  };
  await s.setJSON(`dream/${id}`, dream);
  await upsertIndex(s, dream);
  return json({ ok: true, id, status: "published" }, 201);
};

export const config = { path: "/api/submit", method: "POST" };
