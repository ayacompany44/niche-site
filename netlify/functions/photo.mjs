import { store, isAdmin, ID_RE } from "../lib/store.mjs";

// GET /api/photo/:id/:n[?s=thumb] — publique si le rêve est publié, sinon réservée à la modération
export default async (req, context) => {
  const { id = "", n = "" } = context.params || {};
  if (!ID_RE.test(id) || !/^[0-5]$/.test(n)) return new Response("Introuvable", { status: 404 });
  const thumb = new URL(req.url).searchParams.get("s") === "thumb";
  const s = store();
  const published = !!(await s.get(`dream/${id}`, { type: "json" }));
  if (!published && !isAdmin(req)) return new Response("Introuvable", { status: 404 });
  const bytes = await s.get(`photo/${id}/${n}${thumb ? "-t" : ""}`, { type: "arrayBuffer" });
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": published ? "public, max-age=86400" : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
};

export const config = { path: "/api/photo/:id/:n", method: "GET" };
