# Authentication

The API uses **two tokens**:

| | Access token | Refresh token |
|---|---|---|
| What | RS256 JWT signed with `storage/keys/private.key` | 64-char random string (384 bits) |
| Lifetime | `JWT_TTL` minutes (15) | idle `REFRESH_IDLE_TTL`, capped at `JWT_REFRESH_TTL` from login |
| Where the client keeps it | memory (JS variable / store) | httpOnly cookie, `Path=/api/v1/auth`, `SameSite=Strict` |
| Sent as | `Authorization: Bearer <token>` | automatically by the browser, only to `/api/v1/auth/*` |
| Stored on the server | not stored | only as `HMAC-SHA256(token, REFRESH_TOKEN_PEPPER)` |

JavaScript can never read the refresh token, so an XSS bug cannot steal the long-lived credential.

## Endpoints

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/v1/auth/login` | origin check | Email + password → access token + refresh cookie |
| `POST /api/v1/auth/token/refresh` | refresh cookie + origin check | New access token **and** new refresh cookie. `?include_user=1` on app start |
| `POST /api/v1/auth/logout` | refresh cookie + origin check | Ends this device's session. Works even when the access token is expired |
| `POST /api/v1/auth/logout-all` | Bearer | Ends every session of the user |
| `GET /api/v1/auth/sessions` | Bearer | Lists active devices (`is_current` marks this one) |
| `DELETE /api/v1/auth/sessions/{id}` | Bearer | Ends one device |
| `POST /api/v1/auth/change-password` | Bearer | Changes the password, ends every **other** device |
| `PUT /api/v1/auth/password-reset/{userId}` | Bearer + Admin/Staff | Resets a user's password, ends all their devices |
| `GET /api/v1/auth/me` | Bearer | Current user |

## Sessions and rotation

Every login starts a **family**: a group of rows in `refresh_sessions` sharing one `family_id`. One family = one logged-in device.

```
login            row A (active)                          family F
refresh #1       row A revoked "rotated" -> row B (active)
refresh #2       row B revoked "rotated" -> row C (active)
logout           row C revoked "logout"                  family F ends
```

Each access token carries `sid = family_id`. `JwtService::validateToken()` checks that the family still has an active row, so **ending a session kills its access tokens immediately**, not when they expire.

### Reuse detection

A refresh token is valid once. If an already-rotated token comes back:

- **Within `REFRESH_REUSE_GRACE_SECONDS` (10 s):** two tabs refreshed at the same moment. Answer **409**; the browser already holds the newer cookie, so the client just retries.
- **Later:** somebody replayed a copied token. The **whole family is revoked** (thief and real user are both logged out), the event `REFRESH_TOKEN_REUSE_DETECTED` is logged, and the answer is **401**.

### Refresh error codes

Failed refreshes return `401` with a `code` the frontend can log or show:

| `code` | Meaning |
|---|---|
| `refresh_missing` | No cookie |
| `refresh_invalid` | Unknown token |
| `refresh_revoked` | Logged out |
| `refresh_expired` | Idle or absolute lifetime passed |
| `refresh_reused` | Replay detected, family revoked |
| `user_inactive` | User deactivated or deleted |

Every 401 also clears the cookie. A 409 never touches it.

## CSRF protection

The refresh cookie is sent automatically by the browser, so the cookie endpoints (`login`, `token/refresh`, `logout`) run `TrustedOriginMiddleware`:

- If an `Origin` header is present it must be in `AUTH_TRUSTED_ORIGINS`, `cors.allowed_origins` (wildcards ignored), `APP_URL`, or the API's own origin.
- If there is no `Origin` (server tools, old browsers), the request must send `X-Requested-With: XMLHttpRequest`.

Otherwise: `403`.

## Login responses

```json
{
  "success": true,
  "message": "User admin@email.com logged in successfully!",
  "data": {
    "access": "eyJ0eXAiOiJKV1Qi...",
    "access_expires_in": 900,
    "user": {
      "id": 1, "first_name": "User", "last_name": "Admin", "email": "admin@email.com",
      "user_group": { "id": 1, "name": "Super Admin" },
      "is_superuser": true,
      "permissions": { "Access Rights": ["View", "Update"] }
    }
  }
}
```

Wrong email, wrong password, deactivated and deleted accounts all return the same `401 invalid_credentials` message, so the endpoint cannot be used to discover which emails exist.

## Frontend recipe

```js
// 1. Every call: send the access token; include cookies on auth calls.
api.defaults.headers['X-Requested-With'] = 'XMLHttpRequest'

// 2. On app start: restore the session (the cookie survives page reloads).
const { data } = await api.post('/v1/auth/token/refresh?include_user=1', null, { withCredentials: true })

// 3. On 401 from any API call: refresh ONCE (single-flight), then retry.
//    - refresh 200 -> store data.access, retry
//    - refresh 409 -> retry the original call (another tab refreshed)
//    - refresh 401 -> go to the login page
```

Refresh a little before `access_expires_in` runs out to avoid the 401 round trip.

## Configuration (`config/auth.php`)

| Key | Env | Default |
|---|---|---|
| `jwt_ttl` | `JWT_TTL` | 15 minutes |
| `jwt_refresh_ttl` | `JWT_REFRESH_TTL` | 20160 minutes (absolute cap) |
| `refresh_idle_ttl` | `REFRESH_IDLE_TTL` | same as absolute |
| `refresh_reuse_grace_seconds` | `REFRESH_REUSE_GRACE_SECONDS` | 10 |
| `refresh_token_pepper` | `REFRESH_TOKEN_PEPPER` | required |
| `refresh_cookie.*` | `REFRESH_COOKIE_*` | name `refresh_token`, path `/api/v1/auth`, `Strict` |
| `trusted_origins` | `AUTH_TRUSTED_ORIGINS` | comma separated |

## Where the code lives

| File | Role |
|---|---|
| `app/Services/v1/modules/RefreshTokenService.php` | every token decision: issue, rotate, revoke |
| `app/Services/JWT/JwtService.php` | sign / parse / validate access tokens (checks `sid`) |
| `app/Auth/JwtGuard.php` | the `api` guard used by `auth:api` |
| `app/Http/Controllers/API/v1/modules/AuthController.php` | HTTP only: cookies, headers, status codes |
| `app/Http/Middleware/TrustedOriginMiddleware.php` | CSRF check |
| `app/Models/RefreshSession.php` | table `refresh_sessions` |
