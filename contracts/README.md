# Contracts

## `pricing-catalog.v1.schema.json`: the consumer's pinned copy
The public pricing-catalog contract is owned by TRACK-SUPERADMIN (SA-11 in `erp-system-2026`, `packages/schemas/src/pricing-catalog/`,
merged in PR #547). **This file is a verbatim copy** (never edited here): sha256 `66ae61129107255dbf72d97f49135b90c5bb5c65b5d8ce0ecc8fa1fcdf5dca68`.
v1 is frozen upstream: any change, even an optional field, is a new `v2` file, adopted here in its own batch.

- `pricing-catalog.v1.schema.sha256` is the upstream lock file (copied as is). `tests/catalog.test.mjs` fails if the schema changes
  without updating it, and, when `UPSTREAM_SCHEMA` points at the upstream file, if the two differ.
- `tests/fixtures/pricing-catalog/` holds the upstream valid example and the 22 rejected examples (copied as is): the test proves this
  repo's validator accepts the example and rejects every invalid one.
- **The page's data is the v1 projection**: `data/pricing-catalog.json` (ids `core`/`business`/`advanced`, money as decimal strings, the
  source's own VAT-inclusive amounts). It is the page's TEMPORARY source: its `plan_version_id` values, `catalog_revision` and
  `generated_at` are placeholders until the public read channel (`public_catalog_v1()`, TRD §20.5) is announced ready. Then only
  `loadCatalog()` changes its source; templates and tests do not.
- **Page-owned presentation** lives in `data/pricing-presentation.json` (customer line, highlight badge, card bullets, comparison
  grouping, limit display style), keyed by `plan_id` + feature/limit code. None of it can be in the catalog (`additionalProperties:false`).
- The build validates the catalog against the pinned schema (Ajv 2020, `strict`, `date-time` format registered) and refuses to render
  on any failure.

## Plan ids (D-SA-28)
`core` (الأساسية), `business` (الأعمال), `advanced` (المتقدمة). No fourth plan. The old display ids `launch`/`growth`/`scale` no longer
exist anywhere: registration (`plan` field), `preregister.php` and the ERP handoff use the new ids.

## What the schema cannot check (so `tests/catalog.test.mjs` does)
Unique plan ids and feature codes, the same feature list (code, order, label, availability) in every plan, `amount_incl_vat` =
amount + VAT half-up, annual `amount_per_month` x 12 = `amount_total`, no AI credit and no add-on price.

## Status (2026-11-05)
- Prices: owner-approved display copy, revision 2, now expressed as pricing-catalog v1. Dynamic link to SA-11: **not built**.
- The read layer is `scripts/catalog.mjs`; templates and browser code hold no prices.
