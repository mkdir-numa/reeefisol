# ReFi Hub staking site

Static site for the ReFi Hub validator and refiSOL. Plain HTML, CSS and JS, no build step. Works on GitHub Pages.

## Pages

- `index.html`: Home, with the FAQ
- `institutions.html`: For institutions, with the contact form (sent by email via Web3Forms, see `FORM_KEY` in `assets/site.js`)
- `delegation.html`: For delegation programs. Linked from the footer and the home trust strip, not the top nav
- `refisol.html`: refiSOL, with Jupiter's real swap widget (a pinned, reviewed copy; see below). If it can't load, a fallback card shows a pool-rate estimate and a link to swap on Jupiter
- `donations.html`: Donations. Kept but not linked from anywhere for now
- `audit.html`: Audit our numbers. Lists every verified claim shown on the site with its value, status, check method and source, read straight from `claims.json`. Linked from the Verify column of every footer

## How the numbers work

Every number and checkable fact is read from [`claims.json`](claims.json), the claim register. Nothing numeric is typed into the HTML.

Each claim has the exact text, page and section, the saved value, its source, how it is checked and its status:

- `check`: `live` (fetched on page load), `link` (static link to the source) or `manual` (confirmed by a person)
- `status`: `verified`, `placeholder` or `unverifiable-yet`

Each section ends with one line saying the live data is independently verified by Stakewiz and validators.app (with links), instead of a source chip on every number. If a live fetch fails, the saved value from `claims.json` stays. The register still records each claim's status, including the ones the site shows as pending.

Live sources (all public and CORS-enabled):

- Stakewiz API: stake, APY, 12-month uptime (from its delinquency history), skip rate, commissions, client, location, epoch length, peer yields, stake by source, Argentina count
- Solana RPC (publicnode, then mainnet-beta): refiSOL, jitoSOL and Marinade pool accounts (fees, exchange rate, supply, program)
- Jupiter API: refiSOL holders, swap quotes at 10, 100 and 1,000 SOL, SOL price (for corals per 100K SOL)

To update a saved value, edit its entry in `claims.json` and its `asOf` date. Notes are public: they appear on the audit page and in source tooltips, so write them for visitors. When a claim's `text` is a page fragment, an optional `label` gives the audit page a plain name.

## Run locally

`fetch` needs a server (opening the file directly will not load `claims.json`):

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Files

- `assets/site.css`, `assets/site.js`: styles and the claim renderer
- `assets/brand-tokens.css`: ReFi Hub brand tokens from refihub.io
- `assets/vendor/jupiter-plugin/`: pinned copy of Jupiter's swap widget, never loaded from Jupiter's servers. Don't edit by hand; update with `scripts/vendor-jupiter-plugin.sh` and follow [its README](assets/vendor/jupiter-plugin/README.md)
- `assets/logos/`: official logos, with sources and terms in [`assets/logos/SOURCES.md`](assets/logos/SOURCES.md). No written permission has been obtained for any of them yet.
