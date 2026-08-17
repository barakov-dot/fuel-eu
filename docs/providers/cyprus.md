# Cyprus — Retail Fuel Price Observatory

Verification date: **2026-08-17**

## Publisher

Consumer Protection Service (Υπηρεσία Προστασίας Καταναλωτή), Ministry of Energy, Commerce and Industry.

- Open-data dataset: https://data.gov.cy/en/dataset/432
- Observatory portal: https://www.gov.cy/en/service/retail-fuel-price-observatory/
- Consumer Protection Service: https://consumer.gov.cy/en/price-observatories
- Contact: fuelprices@consumer.gov.cy

## Official system

The Retail Fuel Price Observatory provides **real-time retail fuel prices** from approximately **300 petrol stations** nationwide.

**Five fuel products:**

1. Αμόλυβδη 95 (Unleaded 95)
2. Αμόλυβδη 98 (Unleaded 98)
3. Πετρέλαιο Κίνησης (Automotive Diesel)
4. Πετρέλαιο Θέρμανσης (Heating Oil)
5. Κηροζίνη (Kerosene)

## Machine-readable access

| Aspect | Detail |
|--------|--------|
| Format | XML (after approval) |
| Access | **Application required** — not publicly available |
| Application | Submit via https://www.data.gov.cy/en/form/webform-3516 or eforms.eservices.cyprus.gov.cy |
| Condition | Applicant must provide a **free basic version** of the observatory to consumers |
| Public schema | **Not available** — technical XML schema/documentation only issued after approval |
| Metadata licence | CC BY-SA 4.0 (dataset description only, not the price feed itself) |

## Application process

1. Submit formal data access request to Consumer Protection Service
2. Demonstrate commitment to provide free basic consumer-facing observatory
3. Credentials/XML endpoint issued manually upon approval
4. No automated self-service registration

## Reuse / licence

- Dataset metadata on data.gov.cy: CC BY-SA 4.0
- Actual price XML feed access is conditional on application approval
- Commercial reuse terms specified in access agreement (not publicly documented)

## Attribution

Credit **Consumer Protection Service, Ministry of Energy, Commerce and Industry**.

## Fuel mapping (planned)

| Product | Canonical | Notes |
|---------|-----------|-------|
| Unleaded 95 | sp95 | Ethanol blend not inferred |
| Unleaded 98 | sp98 | |
| Automotive Diesel | diesel | |
| Heating Oil | *(excluded)* | Non-road |
| Kerosene | *(excluded)* | Non-road |

## Decision gate

**BLOCKED** (pending credentials and documentation)

Reason: **CASE C** — access requires application and no public technical XML schema is available. Cannot implement parser without reverse-engineering or inventing schema.

## FuelMap status

| Field | Value |
|-------|-------|
| Provider code | *(not implemented)* |
| Coverage type | `blocked` |
| Access mode | `blocked` |
| Requires credentials | yes |
| Limitations | `requires-application-for-xml-access`, `no-public-technical-schema`, `community-data-only` |

## XML security (when implemented)

When credentials are obtained:

- Use maintained XML parser with XXE protection
- Disable external entity expansion
- Limit document size
- Validate against official schema before production use

## Limitations

- No provider implementation until official schema and credentials received
- Live verification blocked
- Frontend shows community-data notice for Cyprus queries
