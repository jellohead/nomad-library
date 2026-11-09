// Server code with the network mocked. Mostly the website check (/api/library): pasting any normal
// library website should find the catalog. Also requests, email sign-ups and the music CD search.
import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequestGet as library } from "../functions/api/library.js";
import { onRequestPost as request } from "../functions/api/request.js";
import { onRequestPost as notify } from "../functions/api/notify.js";
import { onRequestGet as unsubscribe } from "../functions/api/unsubscribe.js";
import { onRequestGet as search } from "../functions/api/search.js";
import { shape, artistOf } from "../lib/core.js";

const stored = new Map();
globalThis.caches = { default: { async match(k) { return stored.get(k.url)?.clone(); }, async put(k, r) { stored.set(k.url, r.clone()); } } };
const original = globalThis.fetch;
const bc = (slug, site) => Response.json({ entities: { libraries: { [slug]: { longName: `${slug} library`, cmsUrl: site } } } });
// a fake internet: pages by URL, BiblioCommons answers for known slugs
function internet(pages, known) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const g = u.match(/gateway\.bibliocommons\.com\/v2\/libraries\/([a-z0-9-]+)$/);
    if (g) return known[g[1]] ? bc(g[1], known[g[1]]) : new Response("{}", { status: 404 });
    const p = pages[u] || pages[u.replace(/\/$/, "")];
    if (!p) return new Response("nope", { status: 404 });
    if (p.redirect) { const r = new Response(p.html || "<html></html>", { headers: { "content-type": "text/html" } }); Object.defineProperty(r, "url", { value: p.redirect }); return r; }
    if (p.status) return new Response("blocked", { status: p.status });
    return new Response(p.html, { headers: { "content-type": "text/html" } });
  };
}
const env = (libs = {}) => ({ DB: { prepare: sql => ({ bind: (...a) => ({ first: async () => (libs[a[0]] ? { slug: a[0], name: libs[a[0]] } : null), run: async () => ({}) }) }) } });
const ask = async (q, e = env()) => { const r = await library({ request: new Request("https://x/api/library?q=" + encodeURIComponent(q)), env: e, waitUntil() {} }); return { status: r.status, body: await r.json() }; };

await test("a pasted catalog address works as before", async () => {
  internet({}, { chipublib: "https://www.chipublib.org" });
  const r = await ask("https://chipublib.bibliocommons.com/v2/search?query=x");
  assert.equal(r.status, 200); assert.equal(r.body.slug, "chipublib");
});
await test("a normal library website: the catalog link on its homepage is followed", async () => {
  internet({
    "https://smalltown.org": { html: '<a href="/about">About</a> <a href="https://catalog.smalltown.org/search">Search the catalog</a>' },
    "https://catalog.smalltown.org/search": { redirect: "https://smalltown.bibliocommons.com/v2/search", html: "" },
  }, { smalltown: "https://smalltown.org" });
  const r = await ask("smalltown.org");
  assert.equal(r.status, 200); assert.equal(r.body.slug, "smalltown");
});
await test("a homepage that only links to BiblioCommons somewhere in its text", async () => {
  internet({ "https://lib.example.org": { html: '<script>var u="https://eastport.bibliocommons.com/v2/home"</script>' } }, { eastport: "https://lib.example.org" });
  assert.equal((await ask("https://lib.example.org")).body.slug, "eastport");
});
await test("a guess from the web address is believed only when the library's own site agrees", async () => {
  internet({ "https://nypl.org": { html: "<html>no links</html>" }, "https://spl.org": { html: "<html>no links</html>" } },
    { nypl: "https://nypl.bibliocms.com", spl: "http://bibliocms.com/" });
  assert.equal((await ask("nypl.org")).body.slug, "nypl", "nypl.org -> nypl, its own site is nypl.bibliocms.com");
  const wrong = await ask("spl.org");
  assert.equal(wrong.status, 404, "spl.org must NOT open BiblioCommons' unrelated 'spl' (Stratford)"); assert.equal(wrong.body.unsupported, true);
});
await test("a known library website whose homepage hides its catalog still opens", async () => {
  internet({ "https://vpl.ca": { status: 403 } }, { vpl: "http://bibliocms.com/" });
  assert.equal((await ask("https://www.vpl.ca/")).body.slug, "vpl");
});
await test("another catalog system is recognized from the link alone, with a title search for it", async () => {
  internet({ "https://roxbury.aspendiscovery.org": { status: 403 } }, {});
  const r = await ask("https://roxbury.aspendiscovery.org/?browseCategory=x");
  assert.equal(r.status, 404); assert.equal(r.body.unsupported, true);
  assert.equal(r.body.vendor, "aspen"); assert.equal(r.body.host, "roxbury.aspendiscovery.org"); assert.equal(r.body.name, "Roxbury");
  assert.equal(r.body.catalog.find, "https://roxbury.aspendiscovery.org/Search/Results?lookfor={q}&searchIndex=Keyword&searchSource=local");
  assert.doesNotMatch(r.body.error, /catalog|BiblioCommons/i, "the message never uses jargon");
  // a homepage whose "Catalog" link leads to a Polaris catalog on another domain
  internet({ "https://freelibrary.org": { html: '<title>Home | Free Library of Somewhere</title><a href="https://catalog.freelibrary.org/">Catalog</a>' },
    "https://catalog.freelibrary.org/": { html: '<a href="/polaris/search/default.aspx?ctx=3.1033.0.0.6">Search</a> PowerPAC' } }, {});
  const p = await ask("freelibrary.org");
  assert.equal(p.status, 404); assert.equal(p.body.vendor, "polaris"); assert.equal(p.body.name, "Free Library of Somewhere");
  assert.match(p.body.catalog.find, /^https:\/\/catalog\.freelibrary\.org\/polaris\/search\/searchresults\.aspx\?ctx=1\.1033\.0\.0\.1&type=Keyword&term=\{q\}/);
  // nothing recognizable: the website itself is the fallback, flagged as unknown so the page asks for the catalog link
  internet({ "https://tinylib.org": { html: "<title>Tiny Library</title><p>Hours</p>" } }, {});
  const t = await ask("tinylib.org");
  assert.equal(t.status, 404); assert.equal(t.body.unknown, true); assert.equal(t.body.catalog.url, "https://tinylib.org");
});
await test("a site that is down or slow returns a controlled answer", async () => {
  globalThis.fetch = async () => { throw new DOMException("timeout", "TimeoutError"); };
  const r = await ask("down.example.org"); assert.equal(r.status, 404); assert.equal(r.body.unsupported, true);
});
await test("counting a request: validated, clipped, one statement", async () => {
  let sql = "", args = [];
  const e = { DB: { prepare: s => ({ first: async () => ({ n: 3 }), bind: (...a) => { sql = s; args = a; return { run: async () => ({}), first: async () => ({ n: 3 }) }; } }) } };
  const post = body => request({ request: new Request("https://x/api/request", { method: "POST", body: JSON.stringify(body) }), env: e });
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ name: "Denville Free Public Library", city: "Denville", st: "nj", vendor: "Aspen Discovery" })).status, 200);
  assert.match(sql, /ON CONFLICT\(key\) DO UPDATE SET n = n \+ 1/); assert.equal(args[3], "NJ");
  await post({ name: "x".repeat(900) }); assert.ok(args[1].length <= 120);
});
await test("email sign-ups: checked, robots ignored, a duplicate is one row, the library's catalog is kept", async () => {
  const rows = new Map();
  const e = { DB: { prepare: sql => ({
    first: async () => ({ n: rows.size }),
    bind: (...a) => ({
      run: async () => { if (/^INSERT INTO emails/.test(sql)) { const k = a.slice(0, 3).join("|"); if (!rows.has(k)) rows.set(k, a); } if (/^DELETE FROM emails/.test(sql)) for (const [k, r] of rows) if (r[0] === a[0]) rows.delete(k); return {}; },
      first: async () => [...rows.values()].find(r => r[6] === a[0]) ? { email: [...rows.values()].find(r => r[6] === a[0])[0] } : null }) }) } };
  const post = body => notify({ request: new Request("https://x/api/notify", { method: "POST", body: JSON.stringify(body) }), env: e });
  assert.equal((await post({ email: "nope" })).status, 400);
  assert.equal((await post({ email: "bot@example.com", website: "http://spam" })).status, 200); assert.equal(rows.size, 0, "the hidden robot field saves nothing");
  assert.equal((await post({ email: " Fan@Example.com ", kind: "library", lib: { name: "Roxbury", url: "https://roxbury.aspendiscovery.org/?browseCategory=x" } })).status, 200);
  await post({ email: "fan@example.com", kind: "library", lib: { name: "Roxbury", url: "https://roxbury.aspendiscovery.org/" } });
  await post({ email: "fan@example.com", kind: "updates" });
  assert.equal(rows.size, 2, "the same library twice is one row; updates is its own row");
  const lib = [...rows.values()].find(r => r[1] === "library");
  assert.deepEqual(lib.slice(0, 6), ["fan@example.com", "library", "roxbury.aspendiscovery.org", "Roxbury", "https://roxbury.aspendiscovery.org/?browseCategory=x", "aspen"]);
  assert.match(lib[6], /^[A-Za-z0-9_-]{24}$/, "each row has an unsubscribe token");
  const r = await unsubscribe({ request: new Request("https://x/api/unsubscribe?t=" + lib[6]), env: e });
  assert.match(await r.text(), /unsubscribed/); assert.equal(rows.size, 0, "unsubscribe deletes every row for that address");
});
await test("music CDs: the catalog is asked for CDs, with one subject heading per genre", async () => {
  const asked = [];
  const cd = (id, title, authors, fmt = "MUSIC_CD") => [id, { briefInfo: { title, subtitle: "", format: fmt, publicationDate: "1959", authors, subjectHeadings: [], genreForm: [], jacket: {} }, availability: { status: "AVAILABLE", availableCopies: 1, totalCopies: 2, heldCopies: 0 } }];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const bibs = Object.fromEntries([cd("C1", "Kind of Blue", ["Davis, Miles, 1926-1991"]), cd("C2", "Abbey Road", ["Beatles"])]);
    return Response.json({ catalogSearch: { pagination: { count: 2, pages: 1 } }, entities: { bibs } });
  };
  const ask = async q => {
    const r = await search({ request: new Request("https://x/api/search?" + q), env: {}, waitUntil() {} });
    return { status: r.status, body: await r.json() };
  };

  const rock = await ask("lib=chipublib&fmt=music&shelf=rock");
  assert.equal(rock.status, 200);
  assert.match(asked[0], /f_FORMAT=MUSIC_CD/);
  assert.match(asked[0], /query=Rock\+music&searchType=subject/);
  assert.equal(rock.body.rows[0].f, "m");
  assert.equal(rock.body.rows[0].fmt, "CD");
  assert.equal(rock.body.rows[0].artist, "Miles Davis", "catalogs file music under 'Last, First'");
  assert.equal(rock.body.rows[1].artist, "Beatles");
  assert.match(rock.body.rows[0].url, /^https:\/\/chipublib\.bibliocommons\.com\/v2\/record\/C1$/);

  // a film genre is not a music shelf: it must not leak into a CD search
  await ask("lib=seattle&fmt=music&shelf=horror");
  assert.match(asked[1], /query=\*&searchType=bl/);
  assert.doesNotMatch(asked[1], /horror/);

  // a typed search is a keyword search, still CDs only (the gateway indexes the artist, so names work)
  await ask("lib=seattle&fmt=music&q=miles+davis");
  assert.match(asked[2], /query=miles\+davis&searchType=keyword/);
  assert.match(asked[2], /f_FORMAT=MUSIC_CD/);

  // films are untouched
  await ask("lib=seattle&fmt=all&shelf=horror");
  assert.match(asked[3], /query=horror\+films&searchType=subject&f_FORMAT=DVD%7CBLURAY/);
});

await test("an artist's name is read off the record, a film's is left alone", () => {
  assert.equal(artistOf({ authors: ["Jackson, Michael, 1958-2009"] }), "Michael Jackson");
  assert.equal(artistOf({ authors: ["Script (Musical group)"] }), "Script");
  assert.equal(artistOf({ authors: ["Bad Bunny"] }), "Bad Bunny");
  assert.equal(artistOf({ authors: ["Beethoven, Ludwig van"] }), "Ludwig van Beethoven");
  assert.equal(artistOf({}), "");
  const film = shape("seattle", "B1", { briefInfo: { title: "Jaws", format: "BLURAY", authors: ["Spielberg, Steven"] }, availability: {} });
  assert.equal(film.artist, "", "only CDs carry an artist");
  assert.equal(film.f, "b");
});

globalThis.fetch = original;
