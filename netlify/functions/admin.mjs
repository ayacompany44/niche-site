import { store, json, isAdmin, adminConfigured, getIndex, summary, deletePhotos, ID_RE } from "../lib/store.mjs";

// POST /api/admin — modération, protégée par la variable d'environnement ADMIN_PASSWORD
export default async (req) => {
  if (!adminConfigured()) return json({ error: "La modération n'est pas encore activée : ajoute la variable ADMIN_PASSWORD dans Netlify, puis redéploie." }, 503);
  if (!isAdmin(req)) return json({ error: "Mot de passe incorrect." }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête illisible." }, 400); }
  const s = store();
  const id = String(b.id || "");
  if (b.action !== "pending" && b.action !== "login" && !ID_RE.test(id)) return json({ error: "Identifiant invalide." }, 400);

  switch (b.action) {
    case "login":
      return json({ ok: true });

    case "pending": {
      const { blobs } = await s.list({ prefix: "sub/" });
      const subs = [];
      for (const bl of blobs) { const v = await s.get(bl.key, { type: "json" }); if (v) subs.push(v); }
      subs.sort((a, c) => String(a.createdAt).localeCompare(String(c.createdAt)));
      return json({ subs });
    }

    case "approve": {
      const sub = await s.get(`sub/${id}`, { type: "json" });
      if (!sub) return json({ error: "Ce rêve n'est plus en attente." }, 404);
      const dream = {
        id, title: sub.title, story: sub.story, category: sub.category,
        author: sub.anonymous ? "" : sub.author, instagram: sub.anonymous ? "" : sub.instagram,
        anonymous: sub.anonymous, photoCount: sub.photoCount, featured: !!b.featured, example: false,
        submittedAt: sub.createdAt, publishedAt: new Date().toISOString(),
      };
      await s.setJSON(`dream/${id}`, dream);
      const idx = await getIndex(s);
      idx.dreams = [summary(dream), ...idx.dreams.filter((d) => d.id !== id)];
      await s.setJSON("index", idx);
      await s.delete(`sub/${id}`);
      return json({ ok: true });
    }

    case "reject": {
      const sub = await s.get(`sub/${id}`, { type: "json" });
      await deletePhotos(s, id, sub?.photoCount);
      await s.delete(`sub/${id}`);
      return json({ ok: true });
    }

    case "feature": {
      const d = await s.get(`dream/${id}`, { type: "json" });
      if (!d) return json({ error: "Rêve introuvable." }, 404);
      d.featured = !d.featured;
      await s.setJSON(`dream/${id}`, d);
      const idx = await getIndex(s);
      idx.dreams = idx.dreams.map((x) => (x.id === id ? summary(d) : x));
      await s.setJSON("index", idx);
      return json({ ok: true, featured: d.featured });
    }

    case "remove": {
      const d = await s.get(`dream/${id}`, { type: "json" });
      await deletePhotos(s, id, d?.photoCount);
      await s.delete(`dream/${id}`);
      const idx = await getIndex(s);
      idx.dreams = idx.dreams.filter((x) => x.id !== id);
      await s.setJSON("index", idx);
      return json({ ok: true });
    }
  }
  return json({ error: "Action inconnue." }, 400);
};

export const config = { path: "/api/admin", method: "POST" };
