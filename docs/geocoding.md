# FuelMap Europe — Geocoding (Milestone 8)

Place and address search via a provider-neutral geocoding module. The public Nominatim service is for **development and low-volume verification only**.

## Provider abstraction

`GeocodingProvider` interface (`apps/api/src/modules/geocoding/geocoding-provider.interface.ts`):

```typescript
interface GeocodingProvider {
  search(request): Promise<GeocodingResult[]>;
  reverse(request): Promise<ReverseGeocodingResult | null>;
}
```

Implemented providers:

| Provider | Env `GEOCODING_PROVIDER` | Purpose |
|----------|--------------------------|---------|
| Nominatim | `nominatim` (default) | Live geocoding via configured `NOMINATIM_BASE_URL` |
| Mock | `mock` | Deterministic results for automated tests |

Future providers (self-hosted Nominatim, Photon, Pelias, Google, HERE) can implement the same interface without frontend changes.

## Why Nominatim first

- Open-source, self-hostable, OSM-aligned
- Stable `/search` and `/reverse` HTTP APIs
- Fits FuelMap’s plan to self-host geocoding on VPS later

Changing production geocoding should be as simple as:

```env
NOMINATIM_BASE_URL=http://nominatim:8080
```

## Development vs production

- **Development:** `.env.example` points at `https://nominatim.openstreetmap.org` for manual verification only.
- **Automated tests:** Always use `MockGeocodingProvider` — no live Nominatim in CI/unit/e2e.
- **Production (future):** Self-hosted Nominatim or a commercial geocoding provider. Public Nominatim must not be used for launch traffic.

Public Nominatim policy (verified 2026-08-17, Nominatim 5.3.2 docs):

- Maximum **1 request per second**
- Identifiable **User-Agent** (stock library agents are not sufficient)
- **No client-side autocomplete** against public Nominatim
- Cache results; avoid repeated identical queries
- Optional contact email via `NOMINATIM_CONTACT_EMAIL` for larger dev usage

## Search API

### `GET /geocoding/search`

Query parameters:

| Param | Required | Notes |
|-------|----------|-------|
| `q` | yes | 2–200 characters |
| `limit` | no | default 5, max 10 |
| `lat`, `lon` | no | optional bias point (viewbox boost, not hard filter) |
| `countryCodes` | no | comma-separated ISO2 codes |
| `language` | no | `en` or `ru` for MVP |

Response:

```json
{
  "items": [
    {
      "id": "nominatim:R:7444",
      "name": "Paris",
      "displayName": "Paris, Île-de-France, France",
      "location": { "lat": 48.8566, "lon": 2.3522 },
      "type": "city",
      "category": "place",
      "address": {
        "country": "France",
        "countryCode": "fr",
        "city": "Paris",
        "postcode": "75000",
        "road": null
      },
      "boundingBox": { "south": 48.815, "north": 48.902, "west": 2.224, "east": 2.469 }
    }
  ]
}
```

## Reverse API

### `GET /geocoding/reverse`

Query parameters:

| Param | Required | Notes |
|-------|----------|-------|
| `lat`, `lon` | yes | WGS84 coordinates |
| `language` | no | `en` or `ru` |

Returns a single normalized place/address object, or `404` when no result.

## Caching

Redis keys:

- Search: `geocode:search:{provider}:{normalizedQuery}:{limit}:{language}:{countryCodes}:{bias}`
- Reverse: `geocode:reverse:{provider}:{lat}:{lon}:{language}` (coordinates rounded to 5 decimals)

Default TTL: **24 hours** (`GEOCODING_CACHE_TTL_SECONDS=86400`).

If Redis is unavailable or errors, geocoding continues without cache.

## Throttling

`GeocodingRequestThrottle` enforces a minimum interval between **uncached** outgoing provider calls (default **1000 ms**, configurable via `NOMINATIM_MIN_INTERVAL_MS`). Cached hits do not consume throttle slots.

## Privacy

- Search terms and reverse-geocoded coordinates are **not** stored in PostgreSQL.
- Operational logs should avoid full query strings and precise coordinates where possible.
- No analytics added in this milestone.

## Frontend search behavior

Reusable `PlaceSearch` component:

- Minimum **3 characters** before search
- **600 ms debounce** plus explicit Search button / Enter
- Used for main map search, route origin, and route destination
- Keyboard: ArrowUp/ArrowDown, Enter, Escape
- Combobox/listbox ARIA semantics

Route endpoints store optional `label` in UI state and short optional URL params (`fromLabel`, `toLabel`). Routing APIs remain coordinate-based.

Map picks set coordinates immediately, then reverse geocode asynchronously for labels. Failure keeps coordinates.

## Self-hosting migration path

1. Deploy Nominatim (or another provider implementing `GeocodingProvider`).
2. Set `NOMINATIM_BASE_URL` (or swap `GEOCODING_PROVIDER` when additional providers are added).
3. No frontend changes required.

## Security

- Provider base URL comes only from server config (SSRF protection).
- Query length and coordinate inputs validated.
- Provider JSON validated with Zod before normalization.
- Response size capped at 512 KB.

## OSRM production note

Like OSRM, public Nominatim must be replaced with self-hosted or commercial endpoints before public launch.
