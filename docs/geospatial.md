# Geospatial Query Architecture

This document describes how FuelMap Europe performs station search using PostGIS.

## Storage strategy

- Canonical station locations are stored as `geometry(Point, 4326)`.
- WGS84 geometry preserves map compatibility and standard GIS tooling.
- Inserts use `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` via `wgs84Point()` helper so SRID is persisted at write time.

## Geography casting for metric distance

All radius filtering and distance sorting cast to `geography` at query time:

```sql
ST_DWithin(
  stations.location::geography,
  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
  :radiusMeters
)

ST_Distance(
  stations.location::geography,
  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
) AS distance_meters
```

Casting to `geography` yields spheroidal distances in meters, which matches user expectations for nearby search.

## Nearby query strategy

`GET /stations/nearby` uses two fixed database queries regardless of result count:

1. Fetch active stations within radius ordered by distance (`ST_DWithin` + `ST_Distance`).
2. Batch-fetch latest price observations for returned station IDs.

Filtering, sorting, and limits are applied in the service layer:

- `fuelTypeId` — keep stations with a latest observation for that fuel
- `onlyWithPrice` — exclude stations with no latest observations
- `maxPrice` + `currency` — filter by latest observation for the selected fuel
- `sort=distance` (default) or `sort=price`
- `limit` (default 50, max 100)

This avoids N+1 price queries while keeping business rules explicit.

## Bounding box strategy

`GET /stations/bbox` uses an envelope intersection:

```sql
ST_Intersects(stations.location, ST_MakeEnvelope(:west, :south, :east, :north, 4326))
```

BBox responses use a lighter payload (id, name, brand, lat, lon, prices).

## Antimeridian limitation

Bounding boxes where `west >= east` are rejected with HTTP 400. This covers antimeridian-crossing boxes. EU-27 viewports normally do not require antimeridian support in Milestone 3.

## Latest price batching

Latest prices are derived from append-only `fuel_price_observations` using `DISTINCT ON (station_id, fuel_type_id)` in a single batched query.

## Deterministic observation tie-break

When multiple observations share the same station and fuel type, the latest row is chosen by:

1. `observed_at DESC`
2. `received_at DESC`
3. `id DESC`

The same ordering is used by `/stations/:id/prices/latest` and geospatial endpoints.

## Mixed-currency price sorting

Fuel prices are **not** converted across currencies.

For `sort=price`:

- If `currency` is provided, only observations in that currency are considered.
- If `currency` is omitted and multiple currencies are present in the candidate set, the API returns HTTP 400 rather than comparing unlike currencies.

`maxPrice` always requires both `fuelTypeId` and `currency`.

## Spatial index behavior

Migration `0001_domain_schema.sql` creates:

```sql
CREATE INDEX stations_location_gist_idx ON stations USING GIST (location);
```

This is a geometry GIST index on WGS84 points.

### Expected planner behavior

- **Small development datasets**: PostgreSQL may legitimately choose sequential scans.
- **Production-scale datasets**: nearby queries using `location::geography` can use the geometry GIST index via bounding-box prefilter (`&&`) inside `ST_DWithin`, but a dedicated functional index may become worthwhile at scale:

```sql
CREATE INDEX stations_location_geog_gist_idx
  ON stations USING GIST (geography(location));
```

No additional index is added in Milestone 3 because the current dataset is tiny. Re-evaluate with `EXPLAIN ANALYZE` once station counts reach tens of thousands.

Representative nearby query plan check:

```sql
EXPLAIN ANALYZE
SELECT s.id,
       ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint(24.9384, 60.1699), 4326)::geography) AS distance_m
FROM stations s
WHERE s.is_active = true
  AND ST_DWithin(
    s.location::geography,
    ST_SetSRID(ST_MakePoint(24.9384, 60.1699), 4326)::geography,
    10000
  )
ORDER BY distance_m;
```

## API limits

| Parameter | Default | Maximum |
|-----------|---------|---------|
| `radiusKm` | 10 | 100 |
| nearby `limit` | 50 | 100 |
| bbox `limit` | 500 | 1000 |

## Swagger/OpenAPI

Deferred for Milestone 3. Endpoints are query-param heavy and auth is not implemented yet. Swagger can be added once the public API surface stabilizes and production exposure rules are defined.
