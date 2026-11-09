# This fork

Personal copy of [Chrisgpresents/nomad-library](https://github.com/Chrisgpresents/nomad-library), kept at
[jellohead/nomad-library](https://github.com/jellohead/nomad-library). Not currently intended to be
contributed back upstream — this file exists so that intent, and what's actually different here, is written
down somewhere other than the project's own docs (`README.md`, `CONTRIBUTING.md`, `CLAUDE.md`), which stay as
the upstream maintainer wrote them.

## Remotes

- `origin` → `git@github.com:jellohead/nomad-library.git` (this fork, read/write)
- `upstream` → `https://github.com/Chrisgpresents/nomad-library` (the original, read-only in practice — no
  write access, and nothing here pushes to it)

To pull in the original project's later changes: `git fetch upstream && git merge upstream/main` (on `main`).
Routine work happens on feature branches off `main`, pushed to `origin` only.

## What's different from upstream

| Branch | Commit | What it does |
|---|---|---|
| `music-search` | `d6e846a` | Adds a Music button (next to Both / Blu-ray / DVD / Games) that searches a BiblioCommons library's own catalog for music CDs — genre shelves, artist + year on cards, no IMDb ratings or trailers (there's no IMDb for albums). Only works where the catalog can be searched live, so it's hidden at the nationwide shelf, "All my libraries," and catalogs copied by `nomad-library-data` (Vega, Polaris, SirsiDynix, CARL). See the "Music CDs" section added to `README.md` on that branch for the implementation details. |

`main` here still matches `upstream/main` as of 2026-11-08 (`d197354`).

## Resuming elsewhere

```sh
git clone git@github.com:jellohead/nomad-library.git
cd nomad-library
git checkout music-search      # or whatever branch has the current work
npm install
npm run data                   # downloads the IMDb-derived ratings files (not in git)
cp .dev.vars.example .dev.vars
npm run db
npm run dev                    # http://localhost:8788
npm test
```

Needs an SSH key on that machine registered with the `jellohead` GitHub account for `git push`/`pull` to work
without prompting (`ssh-keygen -t ed25519`, then add the `.pub` key under GitHub Settings → SSH and GPG keys,
then `ssh -T git@github.com` to confirm).
