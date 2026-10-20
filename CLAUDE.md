# CLAUDE.md

Guidance for Claude Code when working in this repo. Two people collaborate here (both low-to-mid technical); follow this workflow every time without being asked.

## What this repo is

Static site for the ReFi Hub validator and refiSOL. Plain HTML/CSS/JS, **no build step**. Deployed by GitHub Pages from the `main` branch root: merging a PR to main publishes the site at https://mkdir-numa.github.io/reeefisol/ within a couple of minutes.

- Pages: `index.html`, `institutions.html`, `delegation.html`, `refisol.html`, `donations.html` (unlinked)
- `assets/site.css`, `assets/site.js` — styles and the claim renderer
- Run locally: `python3 -m http.server 8765` then open http://localhost:8765 (opening files directly breaks `fetch`)

## Critical content rule: claims.json

Every number and checkable fact on the site is read from `claims.json` (the claim register) — **never type a numeric or factual claim directly into the HTML**. To change a saved value, edit its entry in `claims.json` and update its `asOf` date. See README.md for the `check`/`status` fields.

## Git workflow (always, no exceptions)

1. **Start from fresh main.** Before any new piece of work: `git checkout main && git pull`. The SessionStart hook reports if main is stale — act on it.
2. **Branch for every change**, however small: `git checkout -b <type>/<short-description>` where type is `feat`, `fix`, `content`, or `chore` (e.g. `content/update-apy-claim`). Never commit on main — a hook blocks it anyway.
3. **Commit to the branch** with clear, plain-English messages describing what changed and why.
4. **When the work is ready**, without being asked: push the branch (`git push -u origin <branch>`) and open a PR with `gh pr create`, filling in the template. The PR description should be understandable by a non-expert: what changed, why, which pages, and how to preview it.
5. **Always end by showing the user the PR URL on its own line** so they can send it to their collaborator for review.
6. **Never merge a PR yourself** unless the user explicitly asks. The default is: the other person reviews and merges on GitHub.
7. After a PR is merged, clean up: `git checkout main && git pull && git branch -d <branch>`.

## Reviewing a PR

When asked to review the other person's PR: `gh pr view <number>`, `gh pr diff <number>`, read the changed files, and give a plain-English summary of what it does, anything risky (especially claims.json correctness and broken links/fetches), and a clear recommendation. Post review comments only when asked.

## Hosting note

The site currently deploys via GitHub Pages from main. The team plans to move to Netlify (or similar) later, which would add per-PR preview links — update this file when that happens.

## Graphics

The animated dotted artwork comes from `assets/stipple.js`: add `<canvas data-stipple="reef" aria-hidden="true"></canvas>` (also `current`, `plate`, `tide`, `pollen`; `data-dark` on dark backgrounds) and size it in CSS. Preview every expression at `prototypes/stipple/`. Earlier explorations are recorded in `docs/design/graphics-round-1.md`.
