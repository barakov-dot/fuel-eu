# Authentication

FuelMap Europe uses **opaque server-side sessions** stored in PostgreSQL with an HttpOnly cookie. Passwords are hashed with **Argon2id**.

## Architecture decision

**Chosen model:** opaque server-side sessions (`auth_sessions` table + HttpOnly cookie).

**Why not JWT access + refresh?** JWT adds refresh rotation, token storage trade-offs, and revocation complexity without benefit for this same-site browser app behind a future reverse proxy.

**Why not Redis sessions?** PostgreSQL sessions are sufficient for MVP scale, survive Redis restarts independently, and keep auth data auditable in one place.

## Session / token strategy

1. On register/login, the API generates a 32-byte random token (base64url).
2. Only a **SHA-256 hash** of the token is stored in `auth_sessions.token_hash`.
3. The raw token is sent to the browser in an HttpOnly cookie (`fuelmap_session` by default).
4. Each request to protected routes validates the cookie token against the hashed row.
5. Multiple concurrent sessions per user are allowed.
6. Logout revokes **only the current session** (sets `revoked_at`).

## Cookie properties

| Property | Development | Production |
|----------|-------------|------------|
| HttpOnly | true | true |
| SameSite | Lax | Lax |
| Secure | false | true |
| Path | `/` | `/` |
| Domain | unset | unset (same host via reverse proxy) |
| Max-Age | `AUTH_SESSION_TTL_SECONDS` (default 30 days) | same |

## Session lifetime & revocation

- Default TTL: **2,592,000 seconds (30 days)** via `AUTH_SESSION_TTL_SECONDS`.
- Expired or revoked sessions return **401** on protected routes.
- Expired rows can be removed with `apps/api/src/database/commands/cleanup-sessions.ts` (future: scheduled job).

## CSRF

**Decision:** `SameSite=Lax` is sufficient for the current architecture.

- State-changing API calls originate from the FuelMap frontend JavaScript (fetch with credentials).
- Cross-site POST form submissions do not include Lax cookies on cross-origin requests.
- Production deployment assumes frontend + API are served under compatible same-site origins via reverse proxy (e.g. `https://fuelmap.example/` and `https://fuelmap.example/api/`).

No separate CSRF token is implemented in Milestone 9.

## CORS

- `WEB_ORIGIN` (default `http://localhost:3000`) configures allowed browser origin.
- `credentials: true` is enabled so HttpOnly session cookies are sent cross-origin in local dev (`localhost:3000` → `localhost:3001`).
- Wildcard `*` is **not** used with credentials.

## Rate limiting

Register and login are protected with `@nestjs/throttler`:

- Login: 10 requests / 60 seconds per IP
- Register: 5 requests / 60 seconds per IP

## Password hashing

Library: **`argon2`** (node-argon2)

Algorithm: **Argon2id**

Parameters:

- `timeCost`: 3
- `memoryCost`: 65536 (64 MiB)
- `parallelism`: 4
- `hashLength`: 32

## Password policy

- Minimum length: **12**
- Maximum length: **128**
- No arbitrary composition rules (passphrases allowed)

## Email normalization

Rule (deterministic, documented in `email-normalization.ts`):

1. Trim whitespace
2. Lowercase entire address
3. No Gmail dot/plus merging or other provider-specific transforms

Original trimmed email is stored for display; normalized form is used for uniqueness and login lookup.

## Password identity model

Password hash is stored on `users.password_hash`. The `auth_identities` table is prepared for future OAuth providers (`google`, `apple`) but is not populated for password accounts in Milestone 9.

## Future OAuth

`auth_identities` supports `(provider, provider_subject)` uniqueness. Google/Apple SDKs are **not** included yet.

## Future email verification / reset

- `users.email_verified_at` exists but remains null (no SMTP).
- Schema does not block future secure reset tokens.

## Deployment topology (expected)

```
Browser ──► Nginx/Caddy (single domain)
              ├── /        → Next.js frontend
              └── /api/    → NestJS API (cookie Path=/, SameSite=Lax)
```

Both apps share a registrable site; session cookies work without cross-site third-party cookie issues.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `WEB_ORIGIN` | Allowed CORS origin(s), comma-separated |
| `AUTH_COOKIE_NAME` | Session cookie name (default `fuelmap_session`) |
| `AUTH_SESSION_TTL_SECONDS` | Session lifetime (default 2592000) |
