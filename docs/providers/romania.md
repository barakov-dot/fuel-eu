# Romania — Monitorul Prețurilor Carburanților

Verification date: **2026-08-17**

## Official system

| Field | Detail |
|-------|--------|
| **Platform** | Monitorul Prețurilor (Fuel Price Monitor) |
| **Operator** | Consiliul Concurenței (Romanian Competition Council) |
| **Partner** | Autoritatea Națională pentru Protecția Consumatorilor (ANPC) |
| **Web** | https://monitorulpreturilor.info/ |
| **Launch** | Fuel module live since 2019 (national transparency programme) |

The platform publishes pump prices for participating fuel networks. Official description lists: benzină standard/premium, motorină standard/premium, GPL, and EV charging filters.

## Participating networks (verified via API)

Public `GetGasNetworks` returns: **PETROM, OMV, MOL, Rompetrol, LUKOIL, SOCAR, Gazprom**.

This is **not** guaranteed complete national coverage — only stations reported by participating networks appear.

## Coverage characteristics

- **Geography:** Romania-wide search by UAT (administrative unit), coordinate buffer, or route
- **Freshness:** stations expose `Updatedate` (e.g. `17/08/2026 11:55`) on XML records
- **Station identity:** stable `Stationid` (e.g. `R1057`, `J087`)
- **Coordinates:** WGS84 in `Addr/Wkt` as `POINT(lon lat)` (SRID 4326 after normalization)
- **Currency:** RON (lei/litre) — dot decimal in API (e.g. `9.51`)
- **Fuels (catalog IDs):** 11 benzină standard, 12 benzină premium, 21 motorină standard, 22 motorină premium, 31 GPL, 41 încărcare electrică

## Machine-readable access research

| Source checked | Result |
|----------------|--------|
| Official API documentation on monitorulpreturilor.info | **Not published** |
| Public XML backend (`/pmonsvc/Gas/*`) | **Accessible without authentication** |
| data.gov.ro open-data dataset | **No dedicated CC-licensed fuel station feed found** |
| PretCarburant.ro REST API | Third-party aggregator — **not official** |

Verified public endpoints (undocumented backend used by official apps):

- `GET https://monitorulpreturilor.info/pmonsvc/Gas/GetGasNetworks`
- `GET https://monitorulpreturilor.info/pmonsvc/Gas/GetGasProductsFromCatalog`
- `GET https://monitorulpreturilor.info/pmonsvc/Gas/GetGasItemsByUat?UatId={id}&CSVGasCatalogProductIds={id}&OrderBy=dist`
- `GET https://monitorulpreturilor.info/pmonsvc/Gas/GetGasItemsByLatLon?lat={lat}&lon={lon}&buffer={m}&CSVGasCatalogProductIds={ids}&OrderBy=dist`

Sample Bucharest probe (`lat=44.4268, lon=26.1025, buffer=2000 m`) returned 12 stations with RON prices, Romanian addresses, and WKT coordinates.

## Reuse / licence / commercial use

| Document | Finding |
|----------|---------|
| monitorulpreturilor.info footer | Prices are public and informational; no programmatic reuse grant |
| portal.consiliulconcurentei.ro Terms (§8) | Prohibits copying, multiplying, distributing, or archiving site materials electronically; prohibits **commercial use** of the site |
| Official API terms | **None published** |

FuelMap is a consumer transparency product, but bulk ingestion/archival of CC backend data without explicit permission falls under unclear reuse rights.

## Decision gate

**BLOCKED_PENDING_PERMISSION**

Reason: **CASE B** — a public XML backend exists and returns official CC data, but there is **no documented machine-readable reuse licence**, participating-network coverage only, and Consiliul Concurenței general terms restrict electronic copying/archiving and commercial site use. Production ingestion requires written permission or an published open-data/API policy.

## FuelMap status

- Reserved provider code: `RO_COMPETITION_COUNCIL_FUEL_PRICES` (not implemented)
- Coverage API marks **RO** as `blocked` with limitations:
  - `undocumented-backend-api`
  - `commercial-reuse-unclear`
  - `partial-participating-networks-only`
  - `pending-official-permission`
  - `community-data-only`
- Frontend shows community-fallback notice in Romania

## If gate opens later

Implementation notes:

- Provider mode: on-demand by lat/lon buffer + periodic UAT sweep for national snapshot
- Dedup: use `Updatedate` when stable; else price-change-only
- Map fuels: standard/premium petrol & diesel separately; skip EV charging for road-fuel UX
- Currency: RON with 2–4 decimal normalization (verify live precision)
- Attribution: Consiliul Concurenței / Monitorul Prețurilor
- Schedule: respect source update cadence (avoid aggressive polling)

## Recommended follow-up

Contact Consiliul Concurenței to request programmatic reuse permission:

- Web: https://www.consiliulconcurentei.ro/
- Platform contact: via monitorulpreturilor.info contact page

Suggested ask: documented REST/XML feed licence for consumer fuel-price apps, stable station IDs, explicit RON price semantics, and rate-limit guidance.
