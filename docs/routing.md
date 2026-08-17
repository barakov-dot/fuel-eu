# FuelMap Europe — Routing (Milestone 7)

Route planning foundation: provider abstraction, corridor search, exact driving detour, and effective fuel savings.

## Provider abstraction

`RoutingProvider` interface (`apps/api/src/modules/routing/routing-provider.interface.ts`):

```typescript
interface RoutingProvider {
  route(request): Promise<RouteResult>;
}
```

Implemented providers:

| Provider | Env `ROUTING_PROVIDER` | Purpose |
|----------|------------------------|---------|
| OSRM | `osrm` (default) | Live routing via configured `OSRM_BASE_URL` |
| Mock | `mock` | Deterministic haversine-based routes for automated tests |

Future providers (Valhalla, GraphHopper, Google Routes) can implement the same interface without changing business logic.

## Why OSRM first

- Open-source, self-hostable, widely used with OpenStreetMap road data
- Stable HTTP API (`/route/v1/{profile}/{coordinates}`)
- GeoJSON geometry output (`geometries=geojson`)
- Fits FuelMap’s plan to self-host a continent-scale routing engine on VPS later

## Development vs production

- **Development:** `.env.example` may point at a public OSRM demo endpoint for manual verification only. Availability is not guaranteed; do not hammer it.
- **Automated tests:** Always use `MockRoutingProvider` — no live OSRM calls in CI/unit/e2e.
- **Production (future):** Self-hosted OSRM (or alternative) on FuelMap infrastructure. No hardcoded public routing servers in production code paths.

## Route response model

FuelMap-neutral `RouteResult` (not raw OSRM):

```json
{
  "distanceMeters": 350000,
  "durationSeconds": 13000,
  "geometry": {
    "type": "LineString",
    "coordinates": [[lon, lat], ...]
  },
  "bbox": { "west", "south", "east", "north" }
}
```

Coordinates remain **`[longitude, latitude]`** (GeoJSON / MapLibre order).

## APIs

### `POST /routes`

Build base route A → B.

### `POST /routes/stations`

Two-stage station search along route with savings ranking.

Required: `fuelTypeId`, `currency`, `refuelLiters`, `vehicleConsumptionLPer100Km`.

## Corridor search (Stage 1)

PostGIS query (`RouteCorridorService`):

1. Build `LINESTRING` from validated provider geometry via `ST_GeomFromGeoJSON` (parameterized).
2. Filter active stations with `ST_DWithin(station.location::geography, route::geography, corridorMeters)`.
3. Join latest price per station/fuel/currency (no N+1).
4. Compute `distanceToRouteMeters` and `routeProgress` (`ST_LineLocatePoint`).
5. Keep up to **50** corridor candidates.

Metric semantics: geography cast → distances in **meters** on WGS84 spheroid.

## Candidate pruning (before exact detour)

From the corridor pool, select up to **12** stations for exact routing:

- Cheapest half (by price, tie-break distance to route)
- Closest-to-route half (by distance, tie-break price)
- Deduplicate by station ID

This avoids optimizing on price alone (a cheap station far from the route may lose after detour).

## Exact detour (Stage 2)

For each shortlisted candidate:

1. Route **A → station → B** via the same provider/profile.
2. Compare to baseline **A → B**:
   - `detourMeters = candidateDistance - baselineDistance` (clamped ≥ 0)
   - `detourDurationSeconds = candidateDuration - baselineDuration` (clamped ≥ 0)

**Not** estimated as `2 × perpendicular distance`.

Concurrency: **4** parallel route requests (`mapWithConcurrency`). Individual detour failures skip that candidate; the overall response still succeeds.

## Savings model

Pure `SavingsCalculatorService` using `decimal.js`:

| Field | Formula |
|-------|---------|
| Gross saving | `(referencePrice - stationPrice) × refuelLiters` |
| Extra fuel | `(detourKm / 100) × vehicleConsumptionLPer100Km` |
| Extra driving cost | `extraFuelLiters × referencePrice` |
| **Effective saving** | `grossSaving - extraDrivingCost` |

Negative effective savings are returned (frontend shows “Not worth the detour”).

### Reference price

- If `referencePrice` provided in request → source `user`
- Else → **median** of corridor candidate prices in requested currency (source `route_median`)
- Never uses the cheapest candidate alone as reference

## Mixed currency

No FX conversion yet. `/routes/stations` requires `currency`; only matching observations are used. Response includes `currencyFilteringApplied: true`.

## Caching

Base routes only (not full `/routes/stations` results):

- Redis key: `route:{provider}:{profile}:{origin}:{via}:{destination}` (6-decimal coords)
- TTL: `ROUTING_CACHE_TTL_SECONDS` (default 600 s / 10 min)
- Cache miss or Redis failure → falls back to live provider

## Error handling

Stable FuelMap errors (no raw OSRM internals):

| Condition | HTTP |
|-----------|------|
| Invalid request | 400 |
| No route | 422 |
| Provider/network failure | 502 |
| Timeout | 504 |
| Routing not configured | 503 |

## Security

- `OSRM_BASE_URL` is server config only — never accepted from client (SSRF prevention)
- Response size limit (5 MB), JSON + Zod validation, request timeout

## Frontend

See `docs/frontend.md` for route planner UX and URL deep links.
