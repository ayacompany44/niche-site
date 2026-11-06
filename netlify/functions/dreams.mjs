import { store, json, getIndex } from "../lib/store.mjs";

// GET /api/dreams — tous les rêves publiés (résumés)
export default async () => {
  const idx = await getIndex(store());
  const dreams = [...idx.dreams].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return json({ dreams });
};

export const config = { path: "/api/dreams", method: "GET" };
