# Build the foundations

A fresh Laravel app can already answer HTTP requests. Before building features we add the **base layer** every module relies on. Do the steps **in order**: each builds on the previous one.

| # | Step | You add | Check |
|---|---|---|---|
| 01 | [Folder conventions](/foundations/01-folder-conventions) | where each kind of file goes | folders exist |
| 02 | [Route auto-loading](/foundations/02-route-autoloading) | one route file per module | `/api/v1/health` answers |
| 03 | [Responses & errors](/foundations/03-responses-and-errors) | one JSON envelope, exceptions → status codes | 404 is JSON |
| 04 | [make:service](/foundations/04-make-service) | a generator for service classes | a service file is created |
| 05 | [Query traits](/foundations/05-query-traits) | `?search`, filters, `?so=` sorting | tinker query |
| 06 | [Activity log](/foundations/06-activity-log) | audit trail + automatic 5xx logging | a row in `activity_log` |
| 07 | [Roles & users](/foundations/07-roles-and-users) | roles, user columns, the first admin | `migrate --seed` |
| 08 | [JWT access tokens](/foundations/08-jwt-access-tokens) | RSA keys, JwtService, the `api` guard | a token in tinker |
| 09 | [Refresh sessions](/foundations/09-refresh-sessions) | login, refresh, logout, logout-all | the login flow works |
| 10 | [Permissions (RBAC)](/foundations/10-rbac) | groups, sub-modules, actions, the user group module | 403 without permission |
| 11 | [API docs](/foundations/11-api-docs) | generated docs at `/docs/api` | the page loads |
| 12 | [File uploads](/foundations/12-file-uploads) | private disk, uploads table, signed URLs | upload a signature |
| 13 | [CORS & rate limits](/foundations/13-cors-and-rate-limits) | frontend on another port/domain, throttling | browser call works |

Afterwards, every feature is built the same way: [Creating a module](/guides/creating-a-module).

## Packages you will install

| Package | Step | Why |
|---|---|---|
| `spatie/laravel-activitylog` | 06 | activity log storage |
| `lcobucci/jwt`, `lcobucci/clock` | 08 | create and validate JWTs |
| `dedoc/scramble` | 11 | API documentation from code |

## The finished structure

```
app/
├── Auth/JwtGuard.php
├── Console/Commands/{MakeServiceCommand,PurgeRefreshSessions}.php
├── Constants/{UserRoles,SubModules,ModuleActions}.php
├── Exceptions/{InvalidException,UnauthorizedException}.php, Auth/*
├── Helpers/{ActivityLogHelper,FileUploadHelper}.php
├── Http/
│   ├── Controllers/API/v1/{global,modules}/
│   ├── Middleware/{ErrorLog,CheckRole,ModulePermission,TrustedOrigin}Middleware.php
│   ├── Requests/
│   └── Resources/{GlobalResponseResource.php, v1/modules/<feature>/}
├── Models/ (+ Concerns/HasUserGroups.php)
├── Providers/{AuthServiceProvider,ScrambleServiceProvider}.php
├── Services/{JWT/JwtService.php, v1/global, v1/modules}
├── Support/{Auth,Rbac}/
└── Traits/{Searchable,Filterable,Sortable}.php
routes/api.php (loader) + routes/v1/modules/*.php
database/seeders/{Rbac/*, data/rbac.php}
stubs/service.stub
storage/keys/ (never committed)
```

::: tip Reference code
Every file shown in these steps is also in the **reference project** that comes with these docs. When something doesn't work, compare your file with it.
:::
