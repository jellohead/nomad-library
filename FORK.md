# This fork

Personal copy of [Chrisgpresents/nomad-library](https://github.com/Chrisgpresents/nomad-library), kept at
[jellohead/nomad-library](https://github.com/jellohead/nomad-library). This file exists so that intent, and what's
actually different here, is written down somewhere other than the project's own docs (`README.md`,
`CONTRIBUTING.md`, `CLAUDE.md`), which stay as the upstream maintainer wrote them.

**Status (2026-11-22): on hold.** Two features are built and pushed, and they work when run locally. Neither can
work on the real site any more, because BiblioCommons now blocks the site's server (see "The gateway block" below).
Nothing has been submitted upstream: no issue comments, no pull requests.

## Remotes

- `origin` → `git@github.com:jellohead/nomad-library.git` (this fork, read/write)
- `upstream` → `https://github.com/Chrisgpresents/nomad-library.git` (the original, read-only in practice: no
  write access, and nothing here pushes to it)

To pull in the original project's later changes: `git fetch upstream && git merge upstream/main` (on `main`).
Routine work happens on feature branches off `main`, pushed to `origin` only.

`main` here is upstream `d197354` plus this file. As of 2026-11-22 upstream is **21 commits ahead** (`e7bc444`),
including big changes to `public/app.js`, so both feature branches would need rework to sit on current upstream.

## What's different from upstream

| Branch | Head | What it does |
|---|---|---|
| `music-search` | `f0e17b9` (feature commit `d6e846a`) | A Music button (next to Both / Blu-ray / DVD / Games) that searches a BiblioCommons library's own catalog for music CDs (`f_FORMAT=MUSIC_CD`). 25 genre shelves, each one subject heading (`MUSIC_SHELVES` in `functions/api/search.js`); artist + year on cards; no IMDb ratings or trailers. Hidden at the nationwide shelf, "All my libraries," and catalogs copied by `nomad-library-data` (Vega, Polaris, SirsiDynix, CARL). See "Music CDs" in `README.md` on that branch. |
| `branch-shelf` | `c39f36c` (built on `music-search`) | "My branch" in Filters: pick a branch and every shelf, search and format shows only what's checked in there right now, via the catalog's own "available now at" filter (`f_STATUS=<code>`). Branch list from `/api/branches` (new). The title page lists which branches have a copy in, with call numbers (`at` in `/api/avail`). Kept per library in `S.branches`. BiblioCommons only. See "My branch" in `README.md` on that branch. |

Both branches have server tests (`test/resolver.mjs`) and real-browser tests (`test/browser.mjs`). Last run on
`branch-shelf`: resolver 13/13; browser 222 pass, 2 fail in the "genres combine" scenario. Those 2 fail the same way
without these changes, and weren't rerun with the Chicago fixture (`FIXTURE_DIR`) that upstream CI uses.

Tried against San Antonio Public Library (`mysapl`, 30 branches, e.g. `BAZAN`, `CENTRAL`). Branch lists also checked
at Chicago (`chipublib`, numeric codes) and Seattle (`seattle`).

## The gateway block (found 2026-11-22)

Upstream's README, "The gateway and freshness (since 11.21.26)": the BiblioCommons gateway answers 403 to every
request from Cloudflare, so the live relay (`/api/search`, `/api/avail`, `/api/find`) no longer works on the real
site, and "We don't route around it." `CONTRIBUTING.md` also rules out anything that "gets around a block a library
has put up." Upstream has since moved the site to the weekly copies made by the copier (`nomad-library-data`).

Both features here depend on that live relay, so:

- They **work locally** (`npm run dev`), because requests leave from your own internet connection.
- They **can't work deployed**, upstream or on a Cloudflare deploy of this fork.
- Sending them upstream as built would be declined. Don't route around the block (e.g. calling the gateway from the
  visitor's browser); upstream treats that as off limits.

## If picking this back up

Ideas, none started:

1. **Personal use only:** keep running the branches locally. Nothing else needed.
2. **Music through the copier:** add CDs to what `nomad-library-data` copies, so Music reads from the weekly files
   like films do. Different repo, and more copier requests (it is kept slow on purpose, about 1 request every 7 s),
   so ask upstream first on [#10](https://github.com/Chrisgpresents/nomad-library/issues/10).
3. **My branch:** a weekly or daily copy can't say what's on a shelf *right now*, at most which branches own a copy.
   Ask on [#17](https://github.com/Chrisgpresents/nomad-library/issues/17) whether that's still worth having before
   building anything.

If contributing upstream later: comment on the issue first ("talk first" for big features), one feature per pull
request, branches cut from `upstream/main` with no `FORK.md` changes, "Part of #10" / "Part of #17" (neither feature
finishes its issue), screenshots at phone and desktop width, and say in the PR how much extra gateway traffic it adds.
Commits carry no AI co-author line (upstream `CLAUDE.md`).

## Local dev gotchas

- **Keep `wrangler` at the pinned `4.45.0`.** An `npm install` of the latest (`4.159.0`) made the local server's
  requests to the gateway come back 403, so every BiblioCommons library fell back to the nationwide shelf. Restore
  with `git restore package.json package-lock.json && npm install`.
- **A failed library lookup is cached for an hour.** `/api/library` sends `cache-control: max-age=3600` on its
  "can't show that library" answer, so after fixing a server problem the same pasted link keeps failing in that
  browser. Use a private window, clear cached files, or change the link slightly (e.g. add `&x=1`).
- If `npm run dev` hangs and ignores Ctrl+C, stop it with `pkill -f "wrangler pages dev"` (and `pkill workerd`).

## Resuming elsewhere

```sh
git clone git@github.com:jellohead/nomad-library.git
cd nomad-library
git remote add upstream https://github.com/Chrisgpresents/nomad-library.git
git checkout branch-shelf      # both features; music-search for Music alone
npm install                    # keeps wrangler at 4.45.0 (see above)
npm run data                   # downloads the IMDb-derived ratings files (not in git)
cp .dev.vars.example .dev.vars
npm run db
npm run dev                    # http://localhost:8788, then paste a BiblioCommons catalog link
npm test
```

Needs an SSH key on that machine registered with the `jellohead` GitHub account for `git push`/`pull` to work
without prompting (`ssh-keygen -t ed25519`, then add the `.pub` key under GitHub Settings → SSH and GPG keys,
then `ssh -T git@github.com` to confirm).
