// GET /api/avail?lib=bclsnj&ids=S1,S2  -> live shelf status for a few titles (the movie page).
// at: the branches with a copy on the shelf right now, each with its call number, so nobody has to click
// through the catalog's copy list to find out where to go.
import { gw, json, SLUG_RE } from "../../lib/core.js";

// One entry per branch; a branch with two copies under different call numbers lists both.
export function onShelfAt(items) {
  const by = new Map();
  for (const i of Object.values(items || {})) {
    if (i?.availability?.status !== "AVAILABLE" || !i.branch?.code) continue;
    const b = by.get(i.branch.code) || { code: i.branch.code, name: (i.branch.name || i.branchName || i.branch.code).trim(), call: [] };
    if (i.callNumber && !b.call.includes(i.callNumber.trim())) b.call.push(i.callNumber.trim());
    by.set(b.code, b);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function onRequestGet(ctx) {
  const u = new URL(ctx.request.url);
  const lib = (u.searchParams.get("lib") || "").toLowerCase();
  const ids = (u.searchParams.get("ids") || "").split(",").filter(id => /^[A-Za-z0-9]{4,40}$/.test(id)).slice(0, 6);
  if (!SLUG_RE.test(lib) || !ids.length) return json({ error: "Bad request" }, { status: 400 });
  const out = {};
  await Promise.all(ids.map(async id => {
    const { ok, d } = await gw(ctx, `${lib}/bibs/${id}/availability`, 120);
    const a = ok && d?.entities?.availabilities?.[id];
    if (a) out[id] = { avail: a.status === "AVAILABLE" || (a.availableCopies || 0) > 0, copies: a.availableCopies || 0, total: a.totalCopies || 0, holds: a.heldCopies || 0,
      at: onShelfAt(d.entities.bibItems) };
  }));
  return json(out, { headers: { "cache-control": "public, max-age=60" } });
}
