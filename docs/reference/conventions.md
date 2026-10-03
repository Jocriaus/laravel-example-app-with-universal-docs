# Conventions checklist

A one-page summary of the rules the rest of the docs explain.

## Naming

| Item | Rule | Example |
|---|---|---|
| Table | plural snake_case | `refresh_sessions` |
| Model | singular StudlyCase | `RefreshSession` |
| URL | `/api/v1/<plural-kebab>` | `/api/v1/user-groups` |
| Route file | `routes/v1/modules/<camelCase>.php` | `userGroup.php` |
| Controller | `<Feature>Controller` in `API/v1/modules` | `UserGroupController` |
| Controller method | verb + noun | `viewUserGroups`, `createUserGroup`, `syncUserGroupMembers` |
| Service | `<Feature>Service` in `Services/v1/modules` | `UserGroupService` |
| Service method | controller method + `Service` | `viewUserGroupsService` |
| Request | `<Feature>Request` | `UserGroupRequest` |
| Resource | `Resources/v1/modules/<feature>/<Feature>Resource` | `userGroup/UserGroupResource` |
| Activity `log_name` | snake_case feature | `user_group` |
| Sort alias | one letter per column | `so=n,asc` |

Common verbs: `view` (list), `get` (one), `create`, `update`, `delete`, `sync` (replace a set), `toggle`.

## Layer rules

| Do | Don't |
|---|---|
| Validate in a FormRequest | Call `$request->validate()` inside a service |
| Put queries and rules in the service | Query models in the controller |
| Return `(object)['success','message']` from services | Return `response()->json()` from services |
| Throw `InvalidException` for broken business rules | Return `['success' => false]` for errors that need a 4xx |
| Log every change with `ActivityLogHelper::log()` | Log reads or token refreshes |
| Shape JSON in a Resource | Return raw models (`return $campus;`) |
| Protect routes with `auth:api` + `Permission::using()` | Check permissions inside the controller |
| Use `SubModules` / `ModuleActions` constants | Type permission names as raw strings |

## HTTP

| Rule | Why |
|---|---|
| `POST` create, `PATCH` update, `DELETE` delete, `PUT` replace a set | Predictable for the frontend |
| `->whereNumber('id')` on `{id}` routes | `/stats` is never read as an id |
| Fixed paths before `{id}` | Same reason |
| Lists: `per_page`, `page`, `search`, `so`, filter keys | Same parameters everywhere |
| Always add a unique tie-breaker (`orderBy('id')`) | Stable pagination |

## Database

- `softDeletes()` on business records; hard deletes only for logs and tokens.
- Unique rules ignore soft-deleted rows: `Rule::unique(...)->whereNull('deleted_at')`.
- Required time columns use `dateTime()`, not `timestamp()`.
- Keep `APP_TIMEZONE` at UTC.
- Wrap multi-table writes in `DB::transaction()`.

## Security

- Never log passwords, tokens or the pepper.
- Never commit `storage/keys/*` or `.env`.
- Login errors are identical for "no account" and "wrong password".
- Files go to the private disk and are served through a controller or a signed URL.
