# Troubleshooting

Common errors, what they mean, and the fix.

## Setup

| Error | Cause | Fix |
|---|---|---|
| `could not find driver` | `pdo_mysql` not enabled | enable `extension=pdo_mysql` in `php.ini` (`php --ini` shows which file) |
| `SQLSTATE[HY000] [1045] Access denied` | wrong `DB_USERNAME` / `DB_PASSWORD` | fix `.env`, then `php artisan config:clear` |
| `SQLSTATE[HY000] [1049] Unknown database` | database not created | `CREATE DATABASE ...` (see [Configure the environment](/start/configure-environment)) |
| `No application encryption key has been specified` | empty `APP_KEY` | `php artisan key:generate` |
| `laravel: command not found` | Composer's global bin not in PATH | add it to PATH, or use `composer create-project` |
| Changes to `.env` ignored | config is cached | `php artisan optimize:clear` |

## Database

| Error | Cause | Fix |
|---|---|---|
| `1067 Invalid default value for 'expires_at'` | a required `timestamp()` column on a MySQL server with `explicit_defaults_for_timestamp=OFF` | use `dateTime()` for required time columns |
| `1452 Cannot add or update a child row: a foreign key constraint fails` | inserting a row that points at a missing parent | seed/create the parent first; check seeder order |
| `1451 Cannot delete or update a parent row` | deleting a row that others still reference (`restrictOnDelete`) | delete or detach the children first, or soft delete |
| `Base table or view not found` | migration not run, or wrong migration order | `php artisan migrate:status`; parent tables need older timestamps |
| `Column not found ... order clause` | a sort key reached SQL | add an allow-list in `implementSort()` |

## Authentication

| Symptom | Cause | Fix |
|---|---|---|
| Login: `REFRESH_TOKEN_PEPPER is not set` | missing pepper | generate it (see [Refresh sessions](/foundations/09-refresh-sessions)), then `config:clear` |
| `JWT key not found at ...` | keys not generated or wrong path | generate the key pair; check `JWT_PRIVATE_KEY_PATH` |
| Login / refresh: **403** `Request origin is not allowed` | frontend origin not trusted | add it to `AUTH_TRUSTED_ORIGINS` (and `CORS_ALLOWED_ORIGINS`) |
| Login / refresh: **403** `Missing required X-Requested-With header` | called from Postman/curl without an Origin | send `X-Requested-With: XMLHttpRequest` |
| Every call **401** right after login | request has no `Authorization: Bearer` header, or `Accept` missing so a redirect happened | send both headers |
| Refresh always **401** `refresh_missing` | cookie not sent | frontend must use `credentials: 'include'`; the call must go to `/api/v1/auth/...` (cookie path) |
| Refresh **409** | two tabs refreshed at once | retry the original request; don't log out |
| Users logged out after deploying | pepper or keys changed | expected; keep them stable per environment |
| `Auth guard [api] is not defined` / driver `jwt` not supported | `AuthServiceProvider` not registered | add it to `bootstrap/providers.php` |

## Permissions

| Symptom | Cause | Fix |
|---|---|---|
| **403** `You do not have permission to ...` | the user's group lacks it | grant it in `data/rbac.php` + seed, or through `PUT /user-groups/{id}/permissions` |
| New sub-module never granted | name typo between routes and seed data | use the `SubModules` constants; the seeder stops on unknown names |
| Admin gets 403 | admin's `user_role_id` isn't 1 | check `UserRoles::ADMINISTRATOR` matches the seeded id |

## Browser / frontend

| Symptom | Cause | Fix |
|---|---|---|
| Console: `blocked by CORS policy` | origin not allowed, or credentials with `*` | exact origins in `config/cors.php`, `supports_credentials: true` |
| Blade form: **419 Page Expired** | missing `@csrf` or the session expired | add `@csrf`; reload the page |
| Blade: `Vite manifest not found` | assets not built | `npm run dev` (local) or `npm run build` |
| API returns an HTML page | error without `Accept: application/json` | send the header; `shouldRenderJsonWhen` (step 03) covers `/api/*` |

## Where to look

1. The response `message` (full details when `APP_DEBUG=true`).
2. `storage/logs/laravel.log`.
3. The activity log (every 5xx is recorded with its payload).
4. `php artisan route:list -v` for routes and their middleware.
5. `php artisan tinker` to try queries and services directly.
