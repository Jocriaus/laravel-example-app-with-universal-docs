# Seeding permissions

All RBAC seed data lives in **one file**: `database/seeders/data/rbac.php`. The seeders in `database/seeders/Rbac/` are generic and should not need editing.

```bash
php artisan db:seed --class=RbacSeeder                                     # everything
php artisan db:seed --class="Database\Seeders\Rbac\UserGroupModuleActionSeeder"   # one step
```

Seeders are **safe to re-run**: existing rows are kept, missing rows are added.

## The data file

```php
return [
    'module_actions' => ['View', 'Create', 'Update', 'Delete', 'Export', /* ... */],

    // module => sub-module => actions (array order = module_order)
    'modules' => [
        'Setup Manager' => [
            'Campus Setup' => ['View', 'Create', 'Update', 'Delete'],
        ],
        'Registrar' => [
            // description defaults to "<Action> <Sub-module>"; override with a key
            'Registrar Configuration' => ['View', 'Update', 'Reset Defaults' => 'Reset Registrar Configuration'],
        ],
    ],

    'user_groups' => [
        'Super Admin' => ['description' => '...', 'permissions' => '*'],
        'Registrar'   => ['description' => '...', 'permissions' => [
            'Registrar'     => ['Student Masterlist' => '*', 'Transcript of Records' => ['View', 'Print']],
            'Setup Manager' => '*',
        ]],
    ],

    'role_default_groups' => ['Admin' => 'Super Admin'],      // user_roles.name => user_groups.name
    'group_members'       => ['admin@email.com' => 'Super Admin'],
];
```

### Permission patterns

| Pattern | Grants |
|---|---|
| `'*'` | every action on every sub-module |
| `['Registrar' => '*']` | every action in one module |
| `['Registrar' => ['Student Masterlist' => '*']]` | every action on one sub-module |
| `['Registrar' => ['Student Masterlist' => ['View', 'Export']]]` | specific actions |

Patterns are expanded against the catalogue by `App\Support\Rbac\PermissionMatrix`. An unknown module, sub-module or action **stops the seed with an error**, so typos never silently create empty permissions.

## Adding a new feature's permissions

Example: a new **Scholarships** screen with View, Create, Update, Approve.

1. **Declare the sub-module** under its module (add the module if it is new):

   ```php
   'modules' => [
       'Registrar' => [
           // ...
           'Scholarships' => ['View', 'Create', 'Update', 'Approve'],
       ],
   ],
   ```

   Every action used must also be in `module_actions`.

2. **Grant it** to the groups that need it:

   ```php
   'Registrar' => ['description' => '...', 'permissions' => [
       'Registrar' => [
           // ...
           'Scholarships' => ['View', 'Create', 'Update'],
       ],
   ]],
   ```

   Groups with `'*'` get it automatically.

3. **Add the constant** in `app/Constants/SubModules.php`:

   ```php
   public const SCHOLARSHIPS = 'Scholarships';
   ```

4. **Seed** and **protect the routes**:

   ```bash
   php artisan db:seed --class=RbacSeeder
   ```

   ```php
   Route::post('/{id}/approve', 'approveScholarship')
       ->middleware(['auth:api', Permission::using(SubModules::SCHOLARSHIPS, ModuleActions::APPROVE)]);
   ```

::: info Seeding only adds
The seeder never removes a permission. That protects changes admins made in the Access Rights screen. To take a permission away, use the screen (`PUT /api/v1/user-groups/{id}/permissions`) or a migration.
:::

## Order of the seeders

`RbacSeeder` runs them in foreign-key order inside one transaction:

```
SystemModule → SystemSubModule → ModuleAction → SystemSubModuleAction
→ UserGroup → UserGroupModuleAction → UserRoleDefaultGroup → UserGroupMember
```

`DatabaseSeeder` calls it after `UserRoleSeeder` and `UserSeeder`, because default groups need roles and members need users. Missing roles or users are skipped with a warning.
