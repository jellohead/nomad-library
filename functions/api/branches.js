// GET /api/branches?lib=mysapl  -> [{ code, name }], the library's branches, for "My branch".
// Every BiblioCommons search lists them in its "available now at" filter (STATUS), with the code the
// catalog takes back as f_STATUS. A search for everything, one result, lists every branch that has anything.
import { gw, json, SLUG_RE } from "../../lib/core.js";

export async function onRequestGet(ctx) {
  const lib = (new URL(ctx.request.url).searchParams.get("lib") || "").toLowerCase();
  if (!SLUG_RE.test(lib)) return json({ error: "Pick a library first." }, { status: 400 });
  const { ok, d } = await gw(ctx, `${lib}/bibs/search?query=*&searchType=bl&limit=1`, 86400);
  if (!ok) return json({ error: "The library's catalog didn't answer. Try again in a minute." }, { status: 502 });
  const status = (d.catalogSearch?.fields || []).find(f => f.id === "STATUS")?.fieldFilters || [];
  // "_online_" and "_physical_" are kinds of item, not places
  const branches = status.filter(f => f.value && !f.value.startsWith("_") && f.label)
    .map(f => ({ code: f.value, name: f.label.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return json(branches, { headers: { "cache-control": "public, max-age=86400" } });
}
