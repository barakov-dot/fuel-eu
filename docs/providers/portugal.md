# Portugal — DGEG Portal Preços dos Combustíveis

Verification date: **2026-08-17**

## Official system

| Field | Detail |
|-------|--------|
| **Portal** | Portal Preços dos Combustíveis Online |
| **Operator** | Direção-Geral de Energia e Geologia (DGEG) |
| **Legal basis** | Decreto-Lei n.º 243/2008 (18 December 2008) |
| **Web** | https://precoscombustiveis.dgeg.gov.pt/ |
| **Presentation** | https://precoscombustiveis.dgeg.gov.pt/apresentacao/ |

License holders must report station characteristics, prices, location, opening hours, and services. Price changes must be communicated before they take effect.

## Data available

- Station-level prices by fuel type, brand, district, municipality
- Map search and “most economical” listings
- Daily national average statistics
- Geographic coordinates for stations (via portal map/search)

## Machine-readable access research

| Source checked | Result |
|----------------|--------|
| Public HTML map/search | Available to consumers — no anonymous bulk API documented |
| DGEG “Partilha de Informação” programme | Formal **data-sharing agreement** required for third-party apps |
| Open REST/JSON feed without registration | **Not published** |
| Anonymous scraping of portal | Prohibited by FuelMap policy |

DGEG states that entities wishing to republish portal information in web/mobile/GPS applications must sign the **Documento “Partilha de Informação”** and receive credentials after approval.

## Reuse / commercial use

From DGEG apresentação page:

- Partnerships require a written request to the Director-General (precoscombustiveis@dgeg.gov.pt)
- Applicant must describe the project and confirm **free and universal** end-user access
- On approval, DGEG registers the entity and issues **portal access credentials**
- Minuta (template) available on the portal

Public consumer browsing is free, but **third-party republication/integration is not self-service**. FuelMap cannot ingest production data without a signed sharing agreement.

## Decision gate

**BLOCKED_PENDING_PERMISSION** (licensing blocker)

FuelMap coverage limitation codes:

- `requires-data-sharing-agreement`
- `commercial-reuse-not-permitted-without-permission`

Coverage type: `blocked`

## FuelMap status

- Reserved provider code: `PT_DGEG_FUEL_PRICES` (not implemented)
- No scraping or undocumented API integration
- Frontend shows simple **“Official integration is currently unavailable.”** (no licence legalese in UI)
- `GET /coverage` lists PT as blocked with licensing limitation codes

## Permission required to proceed

Submit DGEG Partilha de Informação request including:

1. FuelMap Europe project description (consumer EU fuel-price transparency app)
2. Confirmation of free, universal user access (no paywall on official data)
3. Signed partnership document (two copies if postal)
4. Acceptance of DGEG Manual de Utilizador conditions after approval

Contact: **precoscombustiveis@dgeg.gov.pt**

## If gate opens later

Implementation notes:

- Expect credential-gated API or structured export per Manual de Utilizador
- Currency: EUR
- Verify station ID stability and WGS84 coordinates from DGEG feed
- Respect DGEG update/attribution requirements in UI
