# FuelMap Europe — Frontend (Milestone 5)

Mobile-first Next.js frontend for finding nearby fuel stations with MapLibre, backed by the existing NestJS API.

## Architecture

- **App:** `apps/web` (Next.js 16 App Router, TypeScript)
- **Server components:** locale layouts, route shells, metadata
- **Client components:** map, filters, data fetching, charts, i18n runtime
- **State:**
  - URL query params: `fuel`, `radius`, `sort`, `lat`, `lon`, `from`, `to`
  - React local state: selected station, map/list view mode, geolocation status
  - No global state library

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/en` or `/ru` via Next.js 16 `proxy.ts` |
| `/[locale]` | Main map + nearby station list |
| `/[locale]/stations/[id]` | Station detail, current prices, history chart |
| `/status` | Dev status page (unchanged) |

Locales: `en`, `ru`.

## Price display (M14)

Selected prices may include `serviceMode`:

- `self` — self-service (shown as **Self** / **Самообслуживание**)
- `served` — attended (shown as **Served** / **Обслуживание**)
- `unknown` — legacy or providers without mode (no badge)

Italy MIMIT supplies both modes; selection prefers self when available.

## Coverage notices (M14 / M15)

When `/stations/nearby` returns `meta.coverageNotice`, the station list shows a concise banner (limited official data, blocked country, licensing blocker, or missing credentials). See `GET /coverage` for per-country types and limitation codes.

M15 adds honest blocked metadata for **Romania**, **Greece**, and **Portugal** via `provider-capabilities.ts` (static legal/technical registry separate from DB ingestion state).

| ISO2 | Status | User notice (EN) |
|------|--------|------------------|
| RO, GR, LT | Blocked — no official feed | Official live data unavailable; community reports may show |
| PT | Blocked — licensing | Official integration currently unavailable |

## API client

Typed fetch wrappers live in `src/lib/api/`:

- `client.ts` — base URL, error handling, query builder
- `stations.ts` — nearby, bbox, detail, latest, history
- `fuels.ts` — fuel types
- `geocoding.ts` — place search and reverse geocoding
- `routing.ts` — route and route-stations
- `types.ts` — response shapes

Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`).

## Nearby vs bbox

- **`GET /stations/nearby`** powers the ranked list (distance or price sort, radius filter).
- **`GET /stations/bbox`** adds map markers when the user pans/zooms outside the nearby set.
- Bbox requests are debounced (400 ms) and deduplicated by station ID when merged with nearby results.
- Nearby remains the primary UX; bbox failures are non-fatal.

## MapLibre

- Library: `maplibre-gl`
- Loaded only on the client via `next/dynamic` (`StationMapClient.tsx`).
- Style URL: `NEXT_PUBLIC_MAP_STYLE_URL`
  - Development default: `https://demotiles.maplibre.org/style.json`
  - **Production:** choose a proper tile/style provider before launch. Public OSM/demo tiles are not unlimited production infrastructure.
- Markers: GeoJSON source + circle layer + optional price label symbol layer.
- Selection: MapLibre `feature-state`.
- User location: separate GeoJSON point layer (shown only when geolocation is granted).

## Location flow

1. On first load, request browser geolocation once.
2. If granted → use device coordinates for nearby search and user marker.
3. If denied/unavailable/timeout → fall back to Paris (`48.8566, 2.3522`) with a clear UI label.
4. User can still browse the map manually without location.

Location is not persisted to the backend.

## List / map synchronization

- Marker click → selects station in list.
- List card click → selects station.
- “Center on map” → flies map to station and switches to map view on mobile.
- Selection uses shared `selectedStationId` state; no refetch on select.

## i18n

Lightweight dictionary approach (no i18n framework):

- Dictionaries: `src/lib/i18n/dictionaries.ts`
- Provider: `I18nProvider`
- Locale path segments: `/en`, `/ru`
- Locale redirect: `src/proxy.ts` (Next.js 16 proxy convention; replaces deprecated `middleware.ts`)
- Language selector preserves current path and query string

All Milestone 5 user-visible strings have EN and RU versions.

## Price history chart

- Library: **Recharts** (`LineChart`, linear interpolation disabled for missing points)
- Data: `GET /stations/:id/prices/history?fuelTypeId=&from=&to=`
- Period presets computed on the frontend: 24h, 7d, 30d, 90d

## Navigation (external)

Station detail “Navigate” opens external maps URLs (Google Maps, Apple Maps link). No in-app routing engine or Google Maps SDK.

## UI system

Custom CSS design tokens in `globals.css` — no component library. Touch-friendly controls, responsive split layout on desktop (~65% map / ~35% list).

## Route planner (Milestone 7–8)

Route planning UI on the main page (`/[locale]`):

- **Origin:** place search, “My location”, or pick on map
- **Destination:** place search, pick on map, or deep-link from station detail
- **Inputs:** refuel liters, vehicle consumption (L/100 km)
- **Plan:** calls `POST /routes/stations` and shows ranked recommendations

### Place search (`PlaceSearch`)

Reusable combobox component (`apps/web/src/components/search/PlaceSearch.tsx`):

- Main map location search (centers map + nearby list via `?lat=&lon=`)
- Route origin and destination search (resolves to coordinates before routing)
- Minimum 3 characters, 600 ms debounce, explicit Search button
- Keyboard: ArrowUp/ArrowDown, Enter, Escape
- EN/RU strings under `geocode.*` in dictionaries

Route endpoint UI state:

```typescript
{ lat, lon, label? }
```

Labels are presentation-only. Routing APIs remain coordinate-based. Optional short `fromLabel` / `toLabel` URL params; reverse geocoding restores labels on deep links without blocking route calculation.

Map pick sets coordinates immediately, then reverse geocodes asynchronously for a human-readable label.

### Map behaviour

- Blue route line (GeoJSON from API)
- Green **A** / red **B** endpoint markers
- Map pick mode (`crosshair`) when setting start/end — station marker clicks are suppressed during pick
- Route bounds auto-fit when a route is loaded
- Selecting a route candidate highlights the station and centers the map

### Route results panel

Shows route distance/duration, reference price, and candidate cards with:

- Fuel price, distance from route, **actual** extra driving distance/time
- Gross saving, detour fuel cost, effective saving
- Negative savings shown as “Not worth the detour”

Mobile: map/list toggle. Desktop: map ~65% + side panel (nearby list or route results when active).

## URL deep links

| Param | Example | Purpose |
|-------|---------|---------|
| `lat`, `lon` | `?lat=48.8566&lon=2.3522` | Explicit map/nearby center |
| `from`, `to` | `?from=48.8566,2.3522&to=48.1173,-1.6778` | Route endpoints (auto-plans when `fuel` set) |
| `fromLabel`, `toLabel` | optional short labels | Presentation metadata only |
| `fuel` | `?fuel=diesel` | Selected fuel type (existing) |

**Precedence:** When `from`/`to` define an active route, they override generic `lat`/`lon` center. Invalid coordinates are ignored.

Combined example:

`/en?from=48.8566,2.3522&to=48.1173,-1.6778&fuel=diesel`

## Account & auth UX (Milestone 9)

| Route | Purpose |
|-------|---------|
| `/[locale]/login` | Email/password sign-in |
| `/[locale]/register` | Create account |
| `/[locale]/account` | Profile defaults, favorites list, logout |

- Header shows **Sign in** (anonymous) or display name / email link (authenticated).
- Session is HttpOnly cookie; frontend uses `credentials: 'include'` on API fetch.
- Favorite toggle on station cards/detail prompts login when anonymous.
- Saved fuel/refuel/consumption/currency prefills map and route planner (URL/explicit UI wins).

## Community price reporting (Milestone 10)

Station detail (`/[locale]/stations/[id]`):

- **Report price** form (logged-in): fuel, exact decimal price, optional location verification.
- **Community reports** list with confirm/dispute buttons (not on own reports).
- Current price badges: Official / Community / Commercial with confirmation counts for community prices.

## Photo-assisted reporting (Milestone 11)

Station detail toggle:

- **Enter manually** — existing Milestone 10 form.
- **Use photo** — camera/file input (`accept="image/*"`, `capture="environment"`), preview, upload, processing poll, candidate review/edit, confirm → existing report API with `reportImageId`.
- OCR failure or no candidates → manual fallback.
- Community list shows **Photo verified** (image remains private).

See [photo-reporting.md](./photo-reporting.md).

Account page (`/[locale]/account`):

- Reputation score and report counts.
- Recent user reports with links back to stations.

## Intentionally deferred

- Google Maps SDK / Mapbox account
- Turn-by-turn in-app navigation
- Alerts
- Currency conversion
- Marker clustering (add if viewport performance requires it)
- PWA / service worker
- Additional EU languages beyond EN/RU

## Local development

```bash
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Environment (see root `.env.example`):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

Open:

- http://localhost:3000/en
- http://localhost:3000/ru

For France data verification, ensure France ingestion has been run against the local DB and use Paris coordinates or geolocation fallback.

## Testing

```bash
pnpm --filter @fuelmap/web test
```

MapLibre is mocked at the component boundary in Jest/jsdom. Unit tests cover list rendering, filters, formatting, i18n, detail view, and history empty state.
