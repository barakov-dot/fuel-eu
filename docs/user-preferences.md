# User Preferences

Authenticated users can store defaults that prefill the UI. Routing APIs remain **explicit** — preferences never silently change backend request semantics.

## Fields

| Field | Type | Validation |
|-------|------|------------|
| `preferredFuelTypeId` | UUID → `fuel_types` | Must exist |
| `preferredCurrency` | ISO 4217 code → `currencies` | Must exist |
| `defaultRefuelLiters` | numeric(8,2) | > 0, ≤ 200 |
| `vehicleConsumptionLPer100Km` | numeric(6,2) | > 0, ≤ 50 |
| `locale` | `en` \| `ru` | enum |

Stored in `user_preferences` (1:1 with `users`).

## API

- `GET /me/preferences`
- `PATCH /me/preferences` (partial updates; `null` clears optional fields)

## Precedence rules

### Fuel type (main map)

1. URL `?fuel=` code
2. User `preferredFuelTypeId`
3. No selection (user must choose)

### Route planner inputs

1. Explicit UI / URL values on the route form
2. Saved user preferences (`defaultRefuelLiters`, `vehicleConsumptionLPer100Km`, preferred fuel/currency)
3. App generic defaults (`45` L, `7.0` L/100km, `EUR`)

Preferences are edited on the **Account** page; route form changes are not auto-saved.

## Routing integration

When planning a route, the frontend sends explicit JSON to `POST /routes/stations`:

- `fuelTypeId`
- `currency`
- `refuelLiters`
- `vehicleConsumptionLPer100Km`

Saved preferences only **prefill** the form / selected fuel — they do not make the routing endpoint infer user context.

## Currency limitation

Preferred currency is stored for future FX conversion. **No conversion is performed in Milestone 9.**

If station prices use a different currency than the selected preference, the UI keeps original prices and may indicate conversion is unavailable.

## Favorites

See `GET/POST/DELETE /me/favorites` — separate from preferences but listed on the Account page.
