# Greece — Παρατηρητήριο Τιμών Υγρών Καυσίμων (Fuel Price Observatory)

Verification date: **2026-08-17**

## Official system

| Field | Detail |
|-------|--------|
| **Platform** | Παρατηρητήριο Τιμών Υγρών Καυσίμων (Liquid Fuel Price Observatory) |
| **Ministry** | Υπουργείο Ανάπτυξης, Ανταγωνιστικότητας, Υποδομών, Μεταφορών και Δικτύων (Ministry of Development) |
| **Web** | https://www.fuelprices.gr/ |
| **Consumer search** | Public station/address/fuel search across Greece (HTML UI) |
| **Station reporting** | Licensed station owners report prices; ministry publishes submissions without editorial change |

Helpdesk: 210-3843166 (07:00–15:00), webmaster@fuelprices.gr

## Reporting system

- Station owners and ministry partners enter prices via authenticated portals
- Daily **national** and **per-prefecture** bulletins published as **PDF files** (weekends often omitted)
- Consumer map/search UI reads live station submissions, but official bulk publication is PDF-centric

## Machine-readable access research

| Source checked | Result |
|----------------|--------|
| fuelprices.gr daily bulletins | PDF only (national + prefecture averages) |
| fuelprices.gr station search UI | Interactive HTML — not a documented export API |
| data.gov.gr / open-data portal | **No current station-level JSON/XML dataset with reuse licence found** |
| deixto.gr / legacy Tomcat endpoints | Third-party/mobile reverse-engineered paths — **not official ministry API** |
| iMEdD Lab CSV pipeline | Journalistic open-data project scraping PDFs — **not authoritative for ingestion** |

Third-party apps (e.g. fuelGR) reference ministry data but rely on non-documented backends. FuelMap policy excludes these without ministry authorization.

## Coverage characteristics (from official materials)

- Intended national consumer search across licensed reporting stations
- Active reporters only — freshness varies by station compliance (legal prices may be up to ~30 days old per consumer-app context)
- Greek Unicode station names/addresses in official UI
- Currency: EUR
- Fuels include unleaded grades, diesel variants, LPG; heating oil may appear in statistics — road-fuel mapping must be verified before ingestion

## Reuse / licence

fuelprices.gr terms (Όροι χρήσης):

- Ministry publishes station-submitted announcements unchanged
- No grant of programmatic reuse, bulk download, or commercial republication rights
- Ministry disclaims accuracy of third-party station submissions

No official open-data licence or API documentation was found.

## Decision gate

**BLOCKED**

Reason: **CASE C** — no legitimate official machine-readable station-level feed with documented reuse rights. Primary official outputs are PDF statistical bulletins and an HTML consumer search interface. Scraping is prohibited by FuelMap policy.

## FuelMap status

- Reserved provider code: `GR_FUEL_PRICE_OBSERVATORY` (not implemented)
- Coverage API marks **GR** as `blocked` with limitations:
  - `no-official-machine-readable-endpoint`
  - `pdf-bullets-only`
  - `community-data-only`
- Frontend shows community-fallback notice in Greece

## If gate opens later

Implementation notes:

- Verify stable official station ID field and WGS84 coordinates
- Preserve Greek UTF-8 text in `name`, `brand`, `address`, `city`
- Timestamps: `Europe/Athens` with EET/EEST handling
- Service mode: map only if official feed distinguishes self/served
- Dedup: source timestamp when available; else price-change-only

## Recommended follow-up

Request open-data/API publication from the ministry:

- Email: webmaster@fuelprices.gr
- Ministry portal: https://www.mindev.gov.gr/

Suggested ask: daily station-level JSON/CSV with stable IDs, WGS84 coordinates, fuel product codes, EUR prices, observation timestamps, and explicit reuse licence for consumer apps.
