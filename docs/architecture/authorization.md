# Authorization (RBAC)

Authentication answers *who are you*. Authorization answers *what may you do*. The app has two layers.

## 1. Roles: coarse, per route

`users.user_role_id` points at `user_roles` (`Admin` = 1, `Staff` = 2, see `App\Constants\UserRoles`). The `role` middleware checks it:

```php
use App\Constants\UserRoles;

Route::get('/', 'viewUsers')->middleware([
    'auth:api',
    'role:' . UserRoles::roles(UserRoles::ADMINISTRATOR, UserRoles::STAFF),
]);
```

Use roles for platform-level screens (user management, activity log).

## 2. Module permissions: fine-grained

```
User ──(user_group_members)──► UserGroup ──(user_group_module_actions)──► SubModule + Action
                                                                           │
                                                   SystemModule ◄──────────┘
```

| Table | Example rows |
|---|---|
| `system_modules` | Registrar, Admission, Setup Manager, Security |
| `system_sub_modules` | Campus Setup (under Setup Manager), Access Rights (under Security) |
| `module_actions` | View, Create, Update, Delete, Export, Approve, ... |
| `system_sub_modules_actions` | which actions exist on each sub-module (the catalogue) |
| `user_groups` | Registrar, HR, Deans, ... |
| `user_group_members` | which users are in which group (one group per user) |
| `user_group_module_actions` | **the permissions**: group X may do action Y on sub-module Z |

### Protecting a route

```php
use App\Constants\ModuleActions;
use App\Constants\SubModules;
use App\Http\Middleware\ModulePermissionMiddleware as Permission;

Route::post('/', 'createCampus')->middleware([
    'auth:api',
    Permission::using(SubModules::CAMPUS_SETUP, ModuleActions::CREATE),
]);
// same as 'module.permission:Campus Setup,Create'
```

The middleware returns `403` with `"You do not have permission to Create Campus Setup."` when the user's group lacks it.

::: tip Use the constants
`SubModules::CAMPUS_SETUP` instead of `'Campus Setup'` gives you autocompletion and turns a typo into an error instead of a silently locked route. Add a constant whenever you add a sub-module.
:::

### Administrators bypass the check

`HasUserGroups::isSuperUser()` returns true for `UserRoles::ADMINISTRATOR`, and those users pass every `module.permission` check. Change that method if your project marks super admins differently.

### Checking in code

```php
if ($user->hasModulePermission(SubModules::APPLICATION_LIST, ModuleActions::APPROVE)) { ... }
```

All of a user's permissions are loaded in **one query** on the first check and cached for the rest of the request.

### Managing permissions at runtime

The user group module exposes the screens:

| Endpoint | Permission |
|---|---|
| `GET/POST/PATCH/DELETE /api/v1/user-groups[/{id}]` | User Group Management · View/Create/Update/Delete |
| `GET /api/v1/user-groups/stats`, `/filtered-list` | User Group Management · View |
| `GET/PUT /api/v1/user-groups/{id}/members` | User Group Management · View/Update |
| `GET/PUT /api/v1/user-groups/{id}/permissions` | Access Rights · View/Update |

`PUT .../permissions` takes the **complete** list of granted pairs and writes only the difference:

```json
{ "permissions": [ { "system_sub_module": 11, "module_action": 1 }, { "system_sub_module": 11, "module_action": 2 } ] }
```

Pairs that are not in the catalogue are rejected with 400.

### Rules enforced by the module

- A user belongs to **one** group.
- Group 1 (Super Admin) must keep user 1 (the seeded admin).
- A group cannot be deleted while it has members or is a role's default group.

## Adding permissions for a new feature

1. Add the sub-module and its actions to `database/seeders/data/rbac.php`.
2. Grant it to the right groups in the same file.
3. Add a constant to `App\Constants\SubModules`.
4. Protect the routes with `Permission::using(...)`.

Step by step: [Seeding permissions](/guides/seeding-rbac).
