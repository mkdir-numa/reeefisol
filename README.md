# ReFi Hub staking site

Static site for the ReFi Hub validator and refiSOL. Plain HTML, CSS and JS, no build step. Works on GitHub Pages.

## Pages

- `index.html`: Home, with the FAQ
- `institutions.html`: For institutions, with a contact form mockup (not connected)
- `refisol.html`: refiSOL, with a swap widget mockup (rate is live; the real swap opens in Jupiter)
- `donations.html`: Donations. Kept but not linked from anywhere for now

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

To update a saved value, edit its entry in `claims.json` and its `asOf` date.

## Run locally

`fetch` needs a server (opening the file directly will not load `claims.json`):

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Files

- `assets/site.css`, `assets/site.js`: styles and the claim renderer
- `assets/brand-tokens.css`: ReFi Hub brand tokens from refihub.io
- `assets/logos/`: official logos, with sources and terms in [`assets/logos/SOURCES.md`](assets/logos/SOURCES.md). No written permission has been obtained for any of them yet.
