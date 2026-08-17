# FuelMap Europe — Project Specification

## 1. Product

FuelMap Europe is a responsive web application for desktop and mobile that helps drivers across all EU-27 countries find the cheapest nearby fuel stations.

Primary user flow:

1. Detect or select user location.
2. Show nearby fuel stations sorted by effective price.
3. Compare all supported fuel types.
4. Open station details.
5. View historical fuel-price chart.
6. Navigate to the station.
7. Build routes and find advantageous stations along the route.
8. Calculate actual savings including route deviation and fuel consumption.

Initial target:
- EU-27
- Up to ~1,000 users
- Self-hosted VPS
- Infrastructure budget target: €0/month excluding existing VPS

Languages:
- English
- Russian

## 2. Core Features

### Nearby fuel stations

The main application screen should prioritize a list of nearby stations sorted by price.

Each result should include:

- station name
- brand
- distance
- current fuel price
- local currency
- converted user currency
- source
- price freshness
- last update time
- trust/confidence indicator

### Fuel Types

The data model must not hard-code a limited list of fuels.

It should support arbitrary fuel types, including but not limited to:

- E5
- E10
- SP95
- SP98
- Diesel
- Premium Diesel
- E85
- LPG
- CNG
- LNG
- HVO
- Hydrogen
- EV charging where supported later

Fuel aliases from different countries/providers must be mapped to normalized fuel types.

### Historical Prices

All received fuel price observations must be retained.

Users should be able to view price history charts.

Initial periods:

- 24 hours
- 7 days
- 30 days
- 90 days

Historical data must be stored even before the frontend exposes all historical views.

### Navigation

Users must be able to:

- build a route to a selected station
- build an arbitrary A → B route
- search for fuel stations along that route

### Effective Savings

FuelMap Europe should calculate whether leaving the route for cheaper fuel is actually worthwhile.

Inputs may include:

- tank/refuel amount
- vehicle fuel consumption
- extra distance
- selected fuel
- current route
- price difference

Example:

Fuel saving: €5.30
Additional driving cost: €0.70
Effective saving: €4.60

## 3. Maps

Primary map stack:

- MapLibre GL
- OpenStreetMap-based map data

Optional:

- Google Maps

The frontend should use a map-provider abstraction so users can switch providers without changing the core business logic.

Do not couple station/fuel data to the map provider.

## 4. Fuel Price Data Strategy

Fuel data must be ingested through provider adapters.

Priority:

1. Official government/open-data source
2. Licensed commercial/provider API
3. Fuel-chain API/feed
4. Approved third-party source
5. Crowdsourced user report

Google Maps data may only be used if an official supported API and its current licence explicitly permit the intended use.

Do not build production ingestion around scraping Google Maps HTML/web UI.

Each price observation must retain provenance.

Example:

{
  station_id,
  fuel_type_id,
  price,
  currency,
  observed_at,
  received_at,
  source_id,
  source_station_id,
  confidence
}

## 5. Crowdsourcing

Registered users can submit fuel prices manually.

Future functionality:

- photograph station price board
- detect prices with OCR/AI
- ask user to confirm parsed values
- submit confirmed observation

Users have a trust/reputation score.

Signals may include:

- number of accepted reports
- reports confirmed by other users
- agreement with trusted sources
- rejected reports
- account age

Never automatically treat a single user report as authoritative.

## 6. Accounts

Support:

- email/password
- Google authentication
- Apple authentication

Email/password authentication is also required for the admin panel.

Privacy principle:
collect and retain the minimum personal information required.

Do not retain user location history unless explicitly required by a feature and consented to.

## 7. Favorites and Alerts

Users can favorite stations.

Future alerts may include:

- price below threshold
- price decreased
- favorite station updated

## 8. Currency

Store fuel observations in their original/local currency.

Use ISO 4217 currency codes.

Primary FX source:

European Central Bank reference exchange rates.

FX rates should be retrieved daily and cached in the database.

Do not use scraped Google currency conversion data.

Converted prices are display values only.

Original price and currency must always remain available.

## 9. Data Architecture

Recommended relational model:

countries
currencies
stations
station_sources
station_source_mappings
fuel_types
fuel_aliases
station_fuels
fuel_price_observations
data_sources
exchange_rates
users
user_profiles
user_favorites
user_price_reports
user_reputation_events
routes
alerts
ingestion_runs
ingestion_errors

PostgreSQL extensions:

- PostGIS

Never store current price only.

Current price should be derived/materialized from historical observations.

## 10. Backend

Technology:

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- PostGIS
- Redis

Backend responsibilities:

- authentication
- station search
- geospatial queries
- route-aware search
- effective saving calculation
- ingestion
- source normalization
- price history
- user reports
- reputation
- favorites
- admin functions
- exchange rates

Do not expose a public third-party developer API in MVP.

## 11. Frontend

Technology:

- Next.js
- TypeScript

Responsive design must work well on:

- smartphones
- tablets
- desktop

Primary UX should be mobile-first.

## 12. Infrastructure

Everything must be deployable to one self-hosted VPS.

Use Docker Compose.

Initial services:

- reverse proxy
- frontend
- backend
- ingestion worker
- PostgreSQL/PostGIS
- Redis

Avoid paid infrastructure dependencies where a reliable self-hosted/open alternative exists.

Target initial scale:

~1,000 users.

Do not prematurely introduce Kubernetes or distributed microservices.

## 13. Ingestion

Price sources should be isolated using adapters.

Example interface:

FuelPriceProvider

- fetchStations()
- fetchPrices()
- normalizeStation()
- normalizeFuelType()
- normalizePrice()
- healthCheck()

Each country/provider implementation must be independent.

Scheduled ingestion target:

every 5–15 minutes where source rules and update frequency permit it.

Slower official sources should respect their actual publication schedule.

Every run must record:

- source
- start time
- finish time
- records fetched
- records inserted
- records updated
- errors
- source response status

## 14. Admin Panel

Admin must be able to view:

- providers
- ingestion health
- last successful ingestion
- errors
- stale prices
- station counts
- price counts
- suspicious user reports
- user reputation
- duplicate stations
- provider mappings

Admin authentication must support username/email + password.

## 15. Source Confidence

Every displayed price should have a confidence/freshness model.

Example hierarchy:

official recent price
> commercial trusted provider
> fuel-chain direct feed
> multiple matching user reports
> single trusted user report
> unverified report

Confidence and freshness must be separate concepts.

## 16. Station Deduplication

The same physical station may exist in multiple sources.

Do not identify stations exclusively by provider ID.

Build a canonical station entity.

Potential matching signals:

- coordinates
- address
- brand
- normalized name
- phone
- provider identifiers

Provider-specific IDs belong in station_source_mappings.

## 17. Routing

Routing engine must be abstracted from the UI.

Evaluate self-hosted/open options first.

Required operations:

- route A → B
- route current position → station
- distance/time
- stations near route geometry
- route deviation
- additional distance/time

## 18. Privacy / GDPR

Principles:

- data minimization
- no unnecessary precise-location retention
- explicit consent where needed
- account deletion
- export/delete user data
- secure password hashing
- limited logging of personal data

## 19. Cursor Development Workflow

Development workflow:

User → ChatGPT tech lead → Cursor → ChatGPT review → next Cursor task.

The user will provide Cursor's complete result back to ChatGPT.

ChatGPT acts as:

- technical lead
- architect
- implementation planner
- code reviewer
- database reviewer
- security reviewer
- API/data-source reviewer

Do not progress blindly after Cursor changes.

Review relevant output before issuing the next implementation task.

## 20. Mandatory Context7 Rule

Cursor MUST use Context7 whenever implementing or modifying code that depends on:

- frameworks
- third-party libraries
- external APIs
- database libraries
- authentication libraries
- MapLibre
- routing engines
- NestJS
- Next.js
- PostgreSQL/PostGIS integrations
- Redis
- Docker-related software where API/config syntax matters

Before implementation:

1. Resolve the relevant library/API in Context7.
2. Read current documentation for the exact feature being implemented.
3. Do not rely solely on model memory.
4. Prefer current official APIs and recommended patterns.
5. Mention which Context7 documentation was checked in the Cursor completion summary.

If Context7 does not contain the relevant documentation, explicitly report that fact instead of inventing APIs.

## 21. Cursor Change Rules

Cursor must:

- inspect existing repository before changing code
- keep changes scoped to the current task
- avoid unrelated refactoring
- avoid adding dependencies without justification
- use database migrations
- preserve type safety
- add validation at external boundaries
- handle external API failures
- never commit secrets
- keep `.env.example` updated
- add or update tests for meaningful behavior
- report commands run
- report tests run
- report files changed
- report unresolved issues

## 22. Decision Log

Important architectural decisions must be recorded here as the project develops.

Current decisions:

- Product name: FuelMap Europe
- EU-27 from the beginning
- Responsive web application
- Mobile-first UX
- Main screen: cheapest nearby stations
- All fuel types supported through normalized extensible model
- Historical observations retained
- Routing required
- Effective savings calculation required
- Crowdsourcing required
- User reputation required
- Future photo/OCR price reporting
- Email/password + Google + Apple authentication
- Favorites and alerts required
- MapLibre/OSM primary mapping
- optional Google Maps provider
- NestJS backend
- Next.js frontend
- PostgreSQL/PostGIS
- Redis
- self-hosted VPS
- Docker Compose
- target ~1,000 initial users
- ingestion every 5–15 minutes where appropriate
- Russian and English UI
- local + user-selected currencies
- ECB FX source
- privacy-first architecture
- admin panel required

## 23. Cursor Response Log

Paste important Cursor implementation summaries here as development progresses.

---

## 24. Immediate Next Milestone

Milestone 1: repository foundation.

Do not implement country fuel integrations yet.

First establish:

- monorepo/repository layout
- local Docker environment
- PostgreSQL + PostGIS
- Redis
- NestJS backend
- Next.js frontend
- migrations
- health checks
- environment configuration
- linting
- formatting
- tests