# Contracts

`pricing-catalog.v1.schema.json` is the **consumer's pinned copy** of the public pricing-catalog contract.
The contract is owned by TRACK-SUPERADMIN (SA-11 in `erp-system-2026`). Until SA-11 publishes its schema and public
read endpoint, prices on the site come from the **approved display copy** `data/pricing-catalog.json` (owner
directive `manus-tamnex-commerce-catalog-006`, #151 comment 6616623188). **The dynamic link to SA-11 is not built.**

- `pricing-catalog.v1.schema.sha256` locks the pinned copy. `tests/catalog.test.mjs` fails if the schema changes
  without updating the lock, and, when `UPSTREAM_SCHEMA` points at SA-11's published file, if the two differ.
- Switching the source later: point `scripts/catalog.mjs` `loadCatalog()` at the published endpoint or its generated
  export; templates and tests do not change. The JSON file must then stop being edited by hand.

## Status (2026-11-04)
- Site prices: **approved display copy** `data/pricing-catalog.json` `2026-11-04.1`. Dynamic link to SA-11: **not built**.
- The read layer is `scripts/catalog.mjs`; templates and browser code hold no prices.
