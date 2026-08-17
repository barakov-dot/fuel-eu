# France official fuel price provider

Verification date: **2026-08-17**

## Official source

| Field | Value |
|-------|-------|
| Publisher | Ministère de l'Économie / DGCCRF |
| Dataset | Prix des carburants en France - Flux instantané - v2 |
| data.gouv.fr slug | `prix-des-carburants-en-france-flux-instantane-v2-amelioree` |
| Upstream SI | [prix-carburants.gouv.fr](https://www.prix-carburants.gouv.fr/) |

## Selected format

**JSON via Opendatasoft records API** (official derivative maintained on data.economie.gouv.fr):

```
https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records
```

Why not raw XML ZIP from `donnees.roulez-eco.fr`? The v2 columnar JSON/CSV on data.economie.gouv.fr is the current maintained open-data export with typed datetime fields and is easier to validate. It reflects the same official SI data.

Bulk JSON export resource ID (data.gouv.fr): `b0561905-7b5e-4f38-be50-df05708acb80`

## Resource URL discovery

1. Query `https://www.data.gouv.fr/api/1/datasets/prix-des-carburants-en-france-flux-instantane-v2-amelioree/`
2. Locate JSON resource (`b0561905-…` or `format=json`)
3. Fall back to stable records API base URL above

## Licence

Licence Ouverte / Open Licence 2.0 (Etalab)

## Update expectations

Instantaneous feed updated approximately every **10 minutes** (harvest ~15 min on transport.data.gouv.fr).

## Upstream fuel labels (verified 2026-08-17)

| Upstream | Canonical |
|----------|-----------|
| Gazole | diesel |
| SP95 | sp95 |
| SP98 | sp98 |
| E10 | e10 |
| E85 | e85 |
| GPLc | lpg |

Unknown labels are skipped and logged — never auto-mapped.

## Station identifier

Integer `id` field (PDV identifier in the official SI). Stored as string `external_station_id`.

## Coordinates

Prefer `geom.lon` / `geom.lat` (WGS84 decimal degrees).

Legacy scaled strings `latitude` / `longitude` (÷ 100000) are supported as fallback.

Stored as PostGIS `POINT SRID 4326`.

## Timestamps

Per-fuel `{fuel}_maj` ISO-8601 datetime fields (e.g. `gazole_maj`). Parsed to UTC `timestamptz` as `observed_at`. Ingestion time is `received_at`.

## Normalization mappings

See fuel alias seed in `france-source.seed.ts`.

Station updates use "update if meaningful value supplied" — omitted upstream fields do not erase existing DB values.

## Known limitations

- No cross-provider station deduplication
- Stations missing from a single feed are not retired
- Rupture/out-of-stock fuels without prices are not ingested as observations
- Full CSV/JSON export (~20–30 MB) is not loaded; paginated records API is used instead

## Fixture provenance

`apps/api/test/fixtures/france/instantaneous-small.json` — synthetic sample mirroring v2 API field names/shapes, based on live API inspection on 2026-08-17. Not a copy of production data.
