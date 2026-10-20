# Project appendix: reeefisol (ReFi Hub staking site)

**Match markers:** repo directory named `reeefisol`, or a repo containing `claims.json` at the root alongside `index.html` and `assets/site.js`. If these don't match the current repo, ignore this file.

This appendix is authoritative for planning in this repo. It encodes context the repo docs state only partially: why the site exists, which constraints are deliberate, and what "verified" means in a repo with no test suite.

## Why the site exists (weigh every feature against this)

Two audiences, in priority order:

1. **Delegation programs** we already receive stake from — the site is what we point them to when requesting more stake. They score validators on performance, commission, client currency, infrastructure, and decentralization.
2. **Institutions and large SOL holders** on discovery calls — the site must answer "what moves stake" and show we're a credible operator (verifiable numbers, security posture, honest claims).

A feature that serves neither audience needs a strong reason to exist. The "strongest reason not to build" question in Step 1 should usually start here.

## Enduring principles (always bind)

- **The claim register.** Every number and checkable fact on the site is read from `claims.json` — never typed into HTML. Any feature that displays a new number or claim MUST add a register entry (with `source`, `check`: live/link/manual, `status`, `asOf`) and render it via the `data-claim` / `data-render` mechanism in `assets/site.js`. A PDR that puts a numeric fact in markup is wrong by definition.
- **Honest claims only.** Nothing unverifiable presented as fact. "Pending" states are reworded to what is honestly true, not hidden. Impact frameworks/methodology are deliberately deferred until institutional interviews provide primary data — do not spec them (see issue #13).
- **Accessibility and mobile** are table stakes: skip links, aria labels, `prefers-reduced-motion`, and responsive breakpoints exist throughout — new surfaces match them.
- **Git workflow** (from `CLAUDE.md`): branch from fresh main, PR for everything, the other person merges. Commit the finished PDR on a branch + PR; the GitHub issue carries the full text as a working copy.

## Scope-fences (crossing is a flagged, deliberate decision)

- **No build step, no frameworks.** Plain HTML/CSS/JS deployed by GitHub Pages from the main branch root. A feature needing npm, bundlers, or a framework crosses a fence — flag it and justify it; almost nothing on a marketing site should.
- **No backend.** The site is static. Server-ish needs (forms, analytics) are met with third-party services (e.g. Formspree/Tally, Plausible/GoatCounter). A real backend is a major fence.
- **External data sources** are currently Stakewiz, Solana RPC (publicnode → mainnet-beta fallback) and Jupiter — all public, CORS-enabled, with saved fallbacks in `claims.json`. A new live source must meet the same bar (public, CORS, graceful fallback).

## Known file map

| Path | What it is |
| ---- | ---------- |
| `index.html` | Home: hero stats, trust strip, why-us rows, impact, security, FAQ |
| `institutions.html` | Managed staking: sample receipt, comparison, public record, how-we-operate `dl`, diligence pack, contact form |
| `refisol.html` | Liquid staking token: swap widget (mockup), how-it-works, impact |
| `donations.html` | Unlinked + noindexed until donation data is real |
| `claims.json` | The claim register: `about`, `updated`, `constants` (addresses/URLs), `sources`, `orgs`, `claims[]` |
| `assets/site.js` | Claim renderer: fetchers (Stakewiz/RPC/Jupiter), `data-claim`/`data-render`/`data-const-href` wiring, nav/FAQ/form behavior |
| `assets/site.css` | All styling; nature palette on top of brand tokens |
| `assets/brand-tokens.css` | ReFi Hub brand tokens extracted from refihub.io — don't edit, layer on top |
| `assets/logos/` + `SOURCES.md` | Partner logos with provenance; no written permission obtained yet |
| `docs/COLLABORATING.md` | The two-person PR workflow, human-readable |

## Verification in this repo (no tests, no CI — this is what §9 means here)

Repo gates that must stay green, as exact commands/steps:

1. **Claims register validity:** `python3 -c "import json; json.load(open('claims.json'))"` — must exit clean. If the feature touched claims, also eyeball that each new entry has `source`, `check`, `status`, `asOf`.
2. **Local render check:** `python3 -m http.server 8765`, then open each touched page at `http://localhost:8765/…`. Verify: live values populate (no stuck `…`), then kill the network (devtools offline) and reload to verify saved fallbacks render instead.
3. **Console clean:** no errors in the browser console on any touched page.
4. **Mobile pass:** each touched page at ~375px width — nav menu works, no horizontal scroll.
5. **Link check:** every new `href` resolves (internal anchors exist; external links open).

A PDR's verification table should instantiate these for the touched pages and add feature-specific manual steps. "It looks right on my machine" is not a step; numbered checks are.

## GitHub conventions

- Labels in use: `launch-monday`, `deferred`, `needs-decision`, plus GitHub defaults (`enhancement`, `bug`, `accessibility`, …). Pick from these.
- Branch prefixes: `feat/`, `fix/`, `content/`, `chore/`.
- PR descriptions are written for a non-expert: what changed, why, which pages, how to preview.
