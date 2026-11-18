# AGENTS.md: tamnex-site (public)

Claude, Codex, Gemini, Cursor and every other coding agent read this file first.
`CLAUDE.md` and `GEMINI.md` import it.

## This repository is PUBLIC
- This is the marketing site for **Tamnex (تامنكس)** at https://tamnex.com. See `README.md` for the layout and build.
- Never add secrets, tokens, private URLs, internal documents, customer data, unreleased brand assets, or text copied from private repositories.
- Prices live only in `data/pricing-catalog.json`. All page words live in `src/i18n/{ar,en}.json`.
- Generated pages under `site/**/index.html` come from `npm run build`. Do not edit them by hand.

## Core facts
- The brand and registered trademark is **Tamnex**.
- The in-product AI assistant is **Tamo (تامو)**: final decision 2026-11-18, see [docs/decisions/2026-11-18-assistant-name-tamo.md](docs/decisions/2026-11-18-assistant-name-tamo.md). It replaces the cancelled placeholder "Nexa/نكسا".
- Formal product decisions are kept in the private Tamnex ERP repository. This repository keeps public-safe mirrors under `docs/decisions/`.

## Decision-capture rule (mandatory)
Any change to a **name, brand, product claim, or pricing** must add or update `docs/decisions/YYYY-MM-DD-<slug>.md` in the **same commit or PR**, with the status, the date and what it replaces.

## Account rule (mandatory)
- The owner is the GitHub account **`fadhelali00`**. Never create, transfer, fork, mirror or gist this repository outside that account.
- Before `gh` writes, run `gh api user -q .login`; it must print `fadhelali00`.

## Conventions
- Use branch + PR. Run `npm run check` before you push.
- Do not add GitHub Actions workflows without approval.
