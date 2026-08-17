# Spain official fuel price provider

## Publisher and licence

| Field | Value |
|-------|-------|
| Publisher | MITECO (Ministerio para la Transición Ecológica y el Reto Demográfico) |
| Dataset | Precio de carburantes en estaciones terrestres |
| Catalogue | [datos.gob.es](https://datos.gob.es/en/catalogo/e05068001-precio-de-carburantes-en-las-gasolineras-espanolas) |
| Service docs | [ServiciosRESTCarburantes help](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help) |
| Verification date | 2026-08-17 |

The dataset is published as open government data under Spain's open data framework. Reuse is permitted with attribution to the official source.

## REST endpoint

| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/` |
| Format | JSON |
| Auth | None (public) |
| Update | Near-real-time snapshot; global `Fecha` timestamp reflects last feed update |

Alternative mirror (same API shape): `https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestres/`

FuelMap uses the `sedeaplicaciones.minetur.gob.es` endpoint by default (`SPAIN_FUEL_API_URL`).

## Response shape

Top-level object:

```json
{
  "Fecha": "17/08/2026 17:08:58",
  "ListaEESSPrecio": [ /* station array */ ],
  "Nota": "...",
  "ResultadoConsulta": "..."
}
```

Each station in `ListaEESSPrecio` includes human-readable JSON keys (not XML `_x0020_` encoding).

## Station identity

| Field | Usage |
|-------|-------|
| `IDEESS` | Official station identifier → `external_station_id` |
| Mapping key | `(data_source_id, external_station_id)` |

## Coordinates

| Upstream field | Format |
|----------------|--------|
| `Latitud` | Decimal string with comma separator, WGS84 |
| `Longitud (WGS84)` | Decimal string with comma separator, WGS84 |

Example: `"40,416800"` / `"-3,703800"` → stored as PostGIS `Point(4326)`.

## Decimal handling

Prices and coordinates use Spanish comma decimals (`"1,679"`). FuelMap normalizes via `parseLocaleDecimal()` — never `parseFloat("1,679")`.

## Timestamp semantics

| Field | Meaning |
|-------|---------|
| `Fecha` | Feed-wide update timestamp in Europe/Madrid civil time (`DD/MM/YYYY HH:mm:ss`) |
| `observed_at` | Parsed `Fecha` converted to UTC (CET/CEST aware) |
| `received_at` | FuelMap ingestion time |

There are **no per-fuel timestamps** in the live feed. Spain uses `price-change-only` deduplication: a new observation is created only when the price changes or on first import, not when `Fecha` advances with unchanged prices.

## Upstream fuel products

Mapped to canonical FuelMap types:

| Upstream field | Canonical code |
|----------------|----------------|
| Gasoleo A | `diesel` |
| Gasoleo Premium | `premium_diesel` |
| Gasolina 95 E5 | `e5` |
| Gasolina 95 E5 Premium | `sp95` |
| Gasolina 95 E10 | `e10` |
| Gasolina 95 E85 | `e85` |
| Gasolina 98 E5 | `sp98` |
| Gases licuados del petróleo | `lpg` |
| Gas Natural Comprimido | `cng` |
| Gas Natural Licuado | `lng` |
| Diésel Renovable | `hvo` |
| Hidrogeno | `hydrogen` |

## Unsupported products (documented, not guessed)

- Gasoleo B (heating diesel, not automotive)
- Gasolina 95 E25, Gasolina 98 E10, Gasolina Renovable
- Adblue, Amoniaco, Biodiesel, Bioetanol, Biogas variants, Metanol

## Known limitations

- Single global timestamp for all prices in a feed snapshot
- Empty price string means fuel not sold at station (skipped, not an error)
- ~11,400 terrestrial stations; full JSON ~12 MB
- Stations absent from a snapshot are not deleted/inactivated

## Provider code

`ES_MITECO_FUEL_PRICES`
