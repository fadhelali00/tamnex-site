# Decision: Tamnex AI assistant name is "Tamo" (تامو)

- **Date:** 2026-11-18
- **Status:** Final (approved by the founder)
- **Supersedes:** "Nexa" (نكسا), the earlier placeholder name. Nexa was cancelled on 2026-11-18.
- **Canonical record:** the Tamnex decisions log in the ERP repository; this file mirrors it for the public site.

## Decision
- The AI assistant inside Tamnex is called **Tamo** (Arabic: **تامو**). The name comes from Tamnex.
- Tamo is an internal, in-product assistant name used under the Tamnex brand ("Tamo by Tamnex" / "تامو من تامنكس").
  The brand is Tamnex. Tamo is not a separate brand.
- Visual identity: the approved head is published on this site. See [2026-11-18-tamo-visual-public.md](2026-11-18-tamo-visual-public.md).

## Applied in this repository
- Every visible "Nexa"/"نكسا" string in `src/i18n/ar.json`, `src/i18n/en.json`, `scripts/build.mjs`,
  `site/assets/*`, the generated `site/**` pages and `tests/e2e.cjs` is now "Tamo"/"تامو".
- Internal identifiers were renamed to match: i18n keys `*_nexa`/`nexa_*` became `*_tamo`/`tamo_*`, the
  section anchor `#nexa` became `#tamo`, and the analytics event `nexa_scene` became `tamo_scene`.
- Arabic grammar fix: the demo prompt now reads "يا تامو، حلّل لي …" (masculine form) instead of "حلّلي".

## Rule
Any future change to a product name, brand, or pricing must update a decision file in the same change.
