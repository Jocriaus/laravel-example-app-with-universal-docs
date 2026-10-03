# 01 · Folder conventions

**Why:** in a big project the hardest question is "where does this go?". Answer it once, for every kind of file, so every module looks the same.

## The layers of a module

Every feature (a "module") is spread over the same places:

| Layer | Folder | Does | Never does |
|---|---|---|---|
| Route | `routes/v1/modules/<feature>.php` | URL, HTTP method, auth + permission middleware | logic |
| Request | `app/Http/Requests/<Feature>Request.php` | validation rules and messages | database writes |
| Controller | `app/Http/Controllers/API/v1/modules/<Feature>Controller.php` | read input, call one service method, choose the status code, catch exceptions | queries, business rules |
| Service | `app/Services/v1/modules/<Feature>Service.php` | queries, business rules, transactions, activity log | read headers or cookies, build HTTP responses |
| Resource | `app/Http/Resources/v1/modules/<feature>/<Feature>Resource.php` | shape the JSON of a model | queries |
| Model | `app/Models/<Feature>.php` | table mapping, relations, query config | business workflows |

```
Route ─► FormRequest ─► Controller ─► Service ─► Model ─► DB
                            │             │
                            ◄─ object ────┘
                            └─► Resource / GlobalResponseResource ─► JSON
```

## `v1`, `modules` and `global`

- **`v1`**: the API version. A breaking change later goes in `v2` next to it.
- **`modules/`**: one business feature with its own permissions (users, user groups, campuses...).
- **`global/`**: endpoints many screens share that belong to no single feature: dropdown options, file display.

## Do it

```bash
mkdir -p app/Http/Controllers/API/v1/{global,modules}
mkdir -p app/Services/v1/{global,modules}
mkdir -p app/Http/Resources/v1/{global,modules}
mkdir -p app/Http/Requests app/Helpers app/Traits app/Constants app/Support
mkdir -p routes/v1/modules
```

On Windows PowerShell, create each folder with `mkdir` without the braces, or create them from your editor.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Table | plural snake_case | `user_groups` |
| Model | singular StudlyCase | `UserGroup` |
| URL | `/api/v1/<plural-kebab>` | `/api/v1/user-groups` |
| Route file | camelCase | `userGroup.php` |
| Controller method | verb + noun | `viewUserGroups`, `createUserGroup` |
| Service method | controller method + `Service` | `viewUserGroupsService` |
| `log_name` | snake_case | `user_group` |

The full list: [Conventions](/reference/conventions).

## Check it works

```bash
ls app/Http/Controllers/API/v1 app/Services/v1 routes/v1
```

shows `global` and `modules` (and `modules` under `routes/v1`).

Next: [02 · Route auto-loading](/foundations/02-route-autoloading)
