# tamnex-website

The public marketing site for **Tamnex (تامنكس)**, published on **https://tamnex.com**. Tamnex by Evexa.

- Product name D-SA-16, domain topology D-SA-17, identity D90 (decisions live in `fadhelali00/erp-system-2026`).
- Separate from the ERP on purpose: no shared code, secrets, hosts or deploy path with the app,
  `admin.tamnex.com` or tenant subdomains.

## Layout
| Path | What |
|---|---|
| `site/` | Everything that is published: static HTML/CSS/JS, self-hosted fonts, `api/interest.php` (sign-ups) |
| `site/assets/readiness.js` | Close-readiness demo engine: synthetic data, one state, integer halalas |
| `tests/` | Engine unit tests, browser tests (Playwright + axe), claims guard |
| `marketing/CLAIMS.md` | What the page may say, its source and status. The page must stay inside it |
| `marketing/SOCIAL.md` | Social profile and post drafts (nothing posted) |
| `DEPLOY.md` | Hosting, deploy and post-deploy checks |
| `brand/` | D90 tokens and identity notes |

## Work rules
- `main` is production. Changes go through a PR; CI must be green before merge.
- No price, trial, timeline, customer, compliance or hosting claim unless `marketing/CLAIMS.md` allows it.
- No competitor or reference product named on the site (D39).

## Run locally
```bash
npm ci
```
```bash
npm run serve
```
```bash
npm test && npm run test:e2e
```
