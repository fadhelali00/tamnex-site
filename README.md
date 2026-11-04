# tamnex-site

The public marketing site for **Tamnex (تامنكس)**, published on **https://tamnex.com**. Tamnex by Evexa.

- Product name D-SA-16, domain topology D-SA-17, identity D90 (decisions live in `fadhelali00/erp-system-2026`).
- Separate from the ERP on purpose: no shared code, secrets, hosts or deploy path with the app,
  `admin.tamnex.com` or tenant subdomains.

## Layout
| Path | What |
|---|---|
| `site/` | Everything that is published. Pages are **generated** by `npm run build`; do not edit `site/**/index.html` by hand |
| `data/pricing-catalog.json` | Prices, cycles, VAT policy, features and limits. The only place a price lives |
| `contracts/` | Pinned public-catalog schema (SA-11 owns it) and its lock |
| `src/i18n/{ar,en}.json` | All page words. `scripts/build.mjs` = structure, `scripts/catalog.mjs` = price read layer |
| `site/assets/readiness.js` | Close-readiness demo engine: synthetic data, one state, integer halalas |
| `tests/` | Engine unit tests, browser tests (Playwright + axe), claims guard |
| Claims register (private) | What the page may say, its source and status, kept in the private ERP repository (`docs/07-go-to-market/tamnex-site/CLAIMS.md`). The page must stay inside it |
| `DEPLOY.md` | Hosting, deploy and post-deploy checks |
| `brand/` | D90 tokens and identity notes |

## Work rules
- `main` is production. Changes go through a PR; CI must be green before merge.
- No price, trial, timeline, customer, compliance or hosting claim unless the private claims register allows it.
- No competitor or reference product named on the site (D39).

## Run locally
```bash
npm ci
```
```bash
npm run serve
```
```bash
npm run check
```
```bash
npm run test:e2e
```
