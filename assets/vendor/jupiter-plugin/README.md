# Jupiter Plugin (pinned copy)

The swap widget on `refisol.html` is [Jupiter Plugin](https://developers.jup.ag/docs/tool-kits/plugin), Jupiter's official embeddable swap. It touches people's wallets and funds, so we do **not** load it from Jupiter's servers. We keep a reviewed, pinned copy here instead.

**Do not edit these files by hand.** Use `scripts/vendor-jupiter-plugin.sh` (below).

## Why a pinned copy

Jupiter's official snippet is `<script src="https://plugin.jup.ag/plugin-v1.js">`. That file has no version in its name and changes whenever Jupiter redeploys, and it then loads a second, larger script from the same server. So whatever Jupiter (or anyone who compromised their hosting) puts there would run on our page, next to our visitors' wallets, and an `integrity` hash can't be used because the file keeps changing.

With the pinned copy:

- The page's Content-Security-Policy (`script-src 'self'`) means **only scripts served from our own site can run** on `refisol.html`. Nothing from `plugin.jup.ag` or any other host can execute there.
- Both scripts carry an `integrity` hash in `refisol.html`, so the browser refuses them if a single byte changes. If that happens, the page shows a plain fallback card with a "Swap on Jupiter" link instead of the widget.
- Updates happen only when we choose, through a PR someone reviews.

## What's here (version 1.0.16)

| File | What it is |
|---|---|
| `plugin-v1.js` | The loader. Defines `window.Jupiter.init()`. |
| `plugin-1.0.16-app.js` | The swap app itself (React, Jupiter's wallet kit, swap form). |
| `plugin-1.0.16-Tailwind.css`, `scoped-preflight-v4.css`, `plugin-1.0.16-Jupiter.css` | Its styles. They load inside a shadow DOM, so they can't affect the rest of our page. |
| `SHA256SUMS.upstream` | Checksums of the files exactly as downloaded from `plugin.jup.ag` on 2026-10-20. |
| `SHA256SUMS` | Checksums after our one patch (below). Run `shasum -a 256 -c SHA256SUMS` in this folder to check nothing changed. |

The license is MIT (from the `@jup-ag/plugin` package bundled in the loader).

**Our one patch:** the loader hard-codes `"https://plugin.jup.ag"` as the place to fetch the app and styles from. The script swaps that one string for `assets/vendor/jupiter-plugin/1.0.16`. Everything else is byte-for-byte upstream. (The npm package `@jup-ag/plugin` wasn't an option: it needs React and a build step, and this site has neither.)

## What the review found (1.0.16)

- **Where code comes from:** the loader fetches exactly four files, all from the one patched origin: the app and three stylesheets. The app bundle loads no further script chunks and uses no `eval`.
- **What it talks to:** Jupiter's APIs only. `ultra-api.jup.ag` gives quotes (`/order`), sends the signed swap (`/execute`) and reads balances. `datapi.jup.ag` handles token search and the "shield" token warnings. It also loads token images (through `wsrv.nl`), Jupiter's logo and the Inter/Poppins fonts from Google Fonts.
- **Tracking:** none found (no Sentry, PostHog, Amplitude, Mixpanel, Google Analytics or similar).
- **Wallet permissions:** connecting gives the widget the wallet's public address. To swap, the widget asks Jupiter for an order, asks the wallet to sign that one transaction (the wallet shows its own approval prompt), then sends the signed transaction to Jupiter. **It can't move funds without the user approving in their wallet.** The bundle contains the wallet adapter's other methods (sign message, sign all and so on), but those are library code; the swap flow uses sign-transaction.
- **Storage:** it remembers the last wallet used (`walletName`) and some settings in `localStorage`, on the visitor's own browser only.
- **Fees:** Jupiter shows its own platform fee on quotes (0.1% when tested). We set **no** referral fee of our own.

## How to update

1. Branch from fresh main, as usual.
2. Run `scripts/vendor-jupiter-plugin.sh <version>`. It refuses if the upstream loader is a different version from the one you asked for, and tells you which one it is. Check the [npm versions](https://www.npmjs.com/package/@jup-ag/plugin?activeTab=versions) or just run it and read the message.
3. Update the two `<script>` tags in `refisol.html` with the new paths and the `integrity` values the script prints. Delete the old version folder.
4. Re-do the review above, with the old and new versions side by side. At minimum, list the outside hosts in each version and compare them: `grep -o -E 'https://[a-zA-Z0-9.-]+' plugin-<version>-app.js | sort -u`. Any new host, analytics, or change in wallet calls needs an explanation before merging.
5. Test locally (`python3 -m http.server 8765`, open `/refisol.html`): the widget loads, typing an amount gives a quote, the token picker opens, and with a real wallet, a **tiny** swap each way works.
6. Open a PR saying which version, what changed in the review, and how you tested.
