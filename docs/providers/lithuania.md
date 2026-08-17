# Lithuania — LEA Fuel Prices

Verification date: **2026-08-17**

## Publisher

Lietuvos energetikos agentūra (LEA, Lithuanian Energy Agency) — VšĮ, company code 304937660.

- Main page: https://www.ena.lt/degalu-kainos-degalinese/
- Daily reports: https://www.ena.lt/dk-pr-pr-duomenys/

## Publication process

- Fuel retailers submit station prices **each working day by 10:00** (local time)
- LEA publishes aggregated daily data on ena.lt
- Some stations voluntarily update more frequently (shown on the website)
- ~700+ stations nationally (April 2026 rollout)

## Machine-readable access research

| Source checked | Result |
|----------------|--------|
| ena.lt daily pages | Human-readable HTML + Excel links (SharePoint-hosted `.xlsx`) |
| data.gov.lt | No dedicated LEA fuel price dataset/API found |
| Official API documentation | **Not published** |
| Open-data licence for bulk reuse | **Not documented** for automated consumption |

Third-party projects (e.g. GitHub scrapers) exist but are **not** official machine-readable endpoints and are out of scope for FuelMap ingestion policy.

## Decision gate

**BLOCKED**

Reason: **CASE C** — only interactive website / downloadable Excel links are publicly available; no documented machine-readable reuse path, no stable official API, and no open-data portal resource with explicit programmatic licence.

## Recommended follow-up

Contact LEA to request open-data publication:

- Email: info@ena.lt
- Open-data portal request: https://data.gov.lt/

Suggested ask: daily station-level CSV/JSON with stable IDs, WGS84 or LKS-94 coordinates, fuel labels, timestamps, and IODL-compatible licence on data.gov.lt.

## FuelMap status

- Provider code reserved conceptually: `LT_LEA_FUEL_PRICES` (not implemented)
- Coverage API marks **LT** as `blocked` with limitation `no-official-machine-readable-endpoint`
- Users in Lithuania see **community data only** notice via `/stations/nearby` metadata

## If gate opens later

Implementation notes for future milestone:

- Verify station ID field and CRS (LKS-94 / EPSG:3346 possible — transform via PostGIS)
- Currency: EUR; watch comma decimal in Excel exports
- Daily schedule after ~10:00 Europe/Vilnius publication
