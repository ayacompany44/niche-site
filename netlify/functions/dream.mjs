import { store, json, getIndex, ID_RE } from "../lib/store.mjs";

// GET /api/dream/:id — un rêve publié, avec son histoire complète
export default async (req, context) => {
  const id = context.params?.id || "";
  if (!ID_RE.test(id)) return json({ error: "Rêve introuvable." }, 404);
  const s = store();
  await getIndex(s);
  const d = await s.get(`dream/${id}`, { type: "json" });
  if (!d) return json({ error: "Rêve introuvable." }, 404);
  return json({ dream: d });
};

export const config = { path: "/api/dream/:id", method: "GET" };
