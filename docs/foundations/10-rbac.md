# 10 · Permissions (RBAC)

**Why:** roles (step 07) are too coarse: a Registrar clerk and a Registrar head are both "Staff" but may do different things. **Role-based access control** with groups gives each screen and action its own permission.

```
User ──(user_group_members)──► UserGroup ──(user_group_module_actions)──► SubModule + Action
                                                                             │
                                                    SystemModule ◄───────────┘
```

| Table | Holds | Example |
|---|---|---|
| `system_modules` | areas of the app | Registrar, Setup Manager, Security |
| `system_sub_modules` | screens inside an area | Campus Setup, Access Rights |
| `module_actions` | verbs | View, Create, Update, Delete, Approve |
| `system_sub_modules_actions` | which verbs each screen offers (the catalogue) | Campus Setup · Create |
| `user_groups` | groups of users | Registrar, HR |
| `user_group_members` | who is in which group (one group per user) | juan → Registrar |
| `user_group_module_actions` | **the permissions** | Registrar may Update Campus Setup |

A route then says what it needs:

```php
Route::post('/', 'createCampus')->middleware(['auth:api', Permission::using(SubModules::CAMPUS_SETUP, ModuleActions::CREATE)]);
```

Administrators (role 1) pass every check.

## 1. Migrations

::: details Eight migrations
**`database/migrations/2026_10_01_000020_create_module_actions_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reusable verbs: View, Create, Update, Delete, Export, Import, Print, Approve, ...
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_actions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_actions');
    }
};
```

**`database/migrations/2026_10_01_000021_create_system_modules_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Top-level area: Registrar, Admission, Setup Manager, Security, Online Admission.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_modules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->integer('module_order')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_modules');
    }
};
```

**`database/migrations/2026_10_01_000022_create_system_sub_modules_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A screen/resource inside a module, e.g. Security -> Access Rights.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_sub_modules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->integer('module_order');
            $table->foreignId('system_module_id')
                ->constrained('system_modules')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_sub_modules');
    }
};
```

**`database/migrations/2026_10_01_000023_create_system_sub_modules_actions_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 *         (db_table = "system_sub_modules_actions")
 * Catalogue of which actions are AVAILABLE on each sub-module
 * (drives the permission tree shown in "Access Rights").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_sub_modules_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('system_sub_module_id')
                ->constrained('system_sub_modules')
                ->restrictOnDelete();
            $table->foreignId('module_action_id')
                ->constrained('module_actions')
                ->restrictOnDelete();
            $table->string('description', 255);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_sub_modules_actions');
    }
};
```

**`database/migrations/2026_10_01_000024_create_user_groups_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Groups of users that share permissions. Soft deleted, so the audit
 * trail still resolves names of deleted groups.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->text('description');

            $table->timestamp('created_at')->nullable()->index();
            $table->timestamp('updated_at')->nullable();
            $table->softDeletes()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_groups');
    }
};
```

**`database/migrations/2026_10_01_000025_create_user_group_members_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pivot between users and user_groups.
 * Convention: a user belongs to ONE group (enforced in app logic, like the
 * DRF serializer). The DB only guarantees no duplicate (group, user) pair.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_group_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_group_id')
                ->constrained('user_groups')
                ->restrictOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->unique(['user_group_id', 'user_id'], 'unique_user_group_member');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_group_members');
    }
};
```

**`database/migrations/2026_10_01_000026_create_user_group_module_actions_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 *         (db_table = "user_group_module_actions")
 * The actual PERMISSION rows: Group X can do Action Y on Sub-module Z.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_group_module_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_group_id')
                ->constrained('user_groups')
                ->restrictOnDelete();
            $table->foreignId('system_sub_module_id')
                ->constrained('system_sub_modules')
                ->restrictOnDelete();
            $table->foreignId('module_action_id')
                ->constrained('module_actions')
                ->restrictOnDelete();

            $table->unique(
                ['user_group_id', 'system_sub_module_id', 'module_action_id'],
                'unique_user_group_submodule_action'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_group_module_actions');
    }
};
```

**`database/migrations/2026_10_01_000027_create_user_role_default_group_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 *         (db_table = "user_role_default_group")
 * Maps a user role (users.UserRole -> "user_roles") to its default group.
 * Requires the user_roles table to be migrated first.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_role_default_group', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_role_id')
                ->constrained('user_roles')
                ->restrictOnDelete();
            $table->foreignId('user_group_id')
                ->constrained('user_groups')
                ->restrictOnDelete();

            $table->unique(['user_role_id', 'user_group_id'], 'unique_user_role_default_group');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_role_default_group');
    }
};
```

:::

## 2. Models

::: details Eight models
**`app/Models/ModuleAction.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ModuleAction extends Model
{
    protected $table = 'module_actions';

    public $timestamps = false;

    protected $fillable = ['name'];

    public function subModuleActions(): HasMany
    {
        return $this->hasMany(SystemSubModuleAction::class, 'module_action_id');
    }

    public function userGroupPermissions(): HasMany
    {
        return $this->hasMany(UserGroupModuleAction::class, 'module_action_id');
    }
}
```

**`app/Models/SystemModule.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SystemModule extends Model
{
    protected $table = 'system_modules';

    public $timestamps = false;

    protected $fillable = ['name', 'module_order'];

    protected $casts = [
        'module_order' => 'integer',
    ];

    public function subModules(): HasMany
    {
        return $this->hasMany(SystemSubModule::class, 'system_module_id')
            ->orderBy('module_order');
    }
}
```

**`app/Models/SystemSubModule.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SystemSubModule extends Model
{
    protected $table = 'system_sub_modules';

    public $timestamps = false;

    protected $fillable = ['name', 'module_order', 'system_module_id'];

    protected $casts = [
        'module_order' => 'integer',
    ];

    public function systemModule(): BelongsTo
    {
        return $this->belongsTo(SystemModule::class, 'system_module_id');
    }

    /** Catalogue rows: which actions exist for this sub-module. */
    public function subModuleActions(): HasMany
    {
        return $this->hasMany(SystemSubModuleAction::class, 'system_sub_module_id');
    }

    /** Shortcut to the ModuleAction models available on this sub-module. */
    public function availableActions(): BelongsToMany
    {
        return $this->belongsToMany(
            ModuleAction::class,
            'system_sub_modules_actions',
            'system_sub_module_id',
            'module_action_id'
        )->withPivot(['id', 'description']);
    }

    public function userGroupPermissions(): HasMany
    {
        return $this->hasMany(UserGroupModuleAction::class, 'system_sub_module_id');
    }

    public function __toString(): string
    {
        return "{$this->systemModule?->name} -> {$this->name}";
    }
}
```

**`app/Models/SystemSubModuleAction.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemSubModuleAction extends Model
{
    protected $table = 'system_sub_modules_actions';

    public $timestamps = false;

    protected $fillable = ['system_sub_module_id', 'module_action_id', 'description'];

    public function systemSubModule(): BelongsTo
    {
        return $this->belongsTo(SystemSubModule::class, 'system_sub_module_id');
    }

    public function moduleAction(): BelongsTo
    {
        return $this->belongsTo(ModuleAction::class, 'module_action_id');
    }
}
```

**`app/Models/UserGroup.php`**

```php
<?php

namespace App\Models;

use App\Exceptions\InvalidException;
use App\Traits\Filterable;
use App\Traits\Searchable;
use App\Traits\Sortable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A group of users that shares a set of permissions (user_groups, soft deleted).
 */
class UserGroup extends Model
{
    use SoftDeletes, Filterable, Searchable, Sortable;

    protected $table = 'user_groups';

    protected $fillable = ['name', 'description'];

    /**
     * Block deletion when the group
     * still has members or is a role's default group.
     */
    protected static function booted(): void
    {
        static::deleting(function (UserGroup $group) {
            if ($group->members()->exists()) {
                throw new InvalidException('Cannot delete a user group that still contains active members.');
            }

            if ($group->roleDefaults()->exists()) {
                throw new InvalidException('Cannot delete this user group because it is designated as a default group for a system role.');
            }
        });
    }

    /** Used by the Searchable / Filterable / Sortable traits. */
    public function getQueryConfig()
    {
        return (object) [
            // Plain column names: Searchable treats "a.b" as relation.column.
            'searchable' => [
                'name',
            ],
            'filterable' => [
                'name' => 'name',
            ],
            'sortAliases' => [
                'i' => 'id',
                'n' => 'name',
            ],
        ];
    }

    /** Only id and name can be sorted; anything else is ignored. */
    public function implementSort(Builder $query, string $column, $direction)
    {
        if (!in_array($column, ['id', 'name'], true)) {
            return $query;
        }

        return $query->orderBy("user_groups.{$column}", strtolower($direction) === 'desc' ? 'desc' : 'asc');
    }

    // ------------------------------------------------------------------
    // Relations
    // ------------------------------------------------------------------
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_group_members', 'user_group_id', 'user_id')
            ->using(UserGroupMember::class)
            ->withPivot('id');
    }
    public function members(): HasMany
    {
        return $this->hasMany(UserGroupMember::class, 'user_group_id');
    }
    public function permissions(): HasMany
    {
        return $this->hasMany(UserGroupModuleAction::class, 'user_group_id');
    }
    public function roleDefaults(): HasMany
    {
        return $this->hasMany(UserRoleDefaultGroup::class, 'user_group_id');
    }

    public function __toString(): string
    {
        return (string) $this->name;
    }
}
```

**`app/Models/UserGroupMember.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Custom pivot so it can be used both as ->using() on the M2M
 * and queried directly as its own model.
 */
class UserGroupMember extends Pivot
{
    protected $table = 'user_group_members';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = ['user_group_id', 'user_id'];

    public function userGroup(): BelongsTo
    {
        return $this->belongsTo(UserGroup::class, 'user_group_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
```

**`app/Models/UserGroupModuleAction.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row = one granted permission (group + sub-module + action).
 */
class UserGroupModuleAction extends Model
{
    protected $table = 'user_group_module_actions';

    public $timestamps = false;

    protected $fillable = ['user_group_id', 'system_sub_module_id', 'module_action_id'];

    public function userGroup(): BelongsTo
    {
        return $this->belongsTo(UserGroup::class, 'user_group_id');
    }

    public function systemSubModule(): BelongsTo
    {
        return $this->belongsTo(SystemSubModule::class, 'system_sub_module_id');
    }

    public function moduleAction(): BelongsTo
    {
        return $this->belongsTo(ModuleAction::class, 'module_action_id');
    }
}
```

**`app/Models/UserRoleDefaultGroup.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Assumes an App\Models\UserRole model on the "user_roles" table.
 */
class UserRoleDefaultGroup extends Model
{
    protected $table = 'user_role_default_group';

    public $timestamps = false;

    protected $fillable = ['user_role_id', 'user_group_id'];

    public function userRole(): BelongsTo
    {
        return $this->belongsTo(UserRole::class, 'user_role_id');
    }

    public function userGroup(): BelongsTo
    {
        return $this->belongsTo(UserGroup::class, 'user_group_id');
    }
}
```

:::

## 3. Give users their groups and permissions

**`app/Models/Concerns/HasUserGroups.php`**

```php
<?php

namespace App\Models\Concerns;

use App\Constants\UserRoles;
use App\Models\UserGroup;
use App\Models\UserGroupMember;
use App\Models\UserGroupModuleAction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Used by App\Models\User.
 * Group membership, permission checks, and the member ranking query.
 */
trait HasUserGroups
{
    /** Resolved "SubModule|Action" keys, cached for the lifetime of the request. */
    private ?array $modulePermissionCache = null;

    public function userGroups(): BelongsToMany
    {
        return $this->belongsToMany(UserGroup::class, 'user_group_members', 'user_id', 'user_group_id')
            ->using(UserGroupMember::class)
            ->withPivot('id');
    }

    /** Convention: one user = one group. */
    public function userGroup(): ?UserGroup
    {
        return $this->userGroups->first();
    }

    /**
     * Administrators bypass module checks.
     * There is no is_superuser column: the Administrator role plays that part.
     */
    public function isSuperUser(): bool
    {
        return (int) $this->user_role_id === UserRoles::ADMINISTRATOR;
    }

    /** e.g. $user->hasModulePermission(SubModules::ACCESS_RIGHTS, ModuleActions::UPDATE) */
    public function hasModulePermission(string $subModule, string $action): bool
    {
        if ($this->isSuperUser()) {
            return true;
        }

        return isset($this->modulePermissions()["{$subModule}|{$action}"]);
    }

    /**
     * Every permission the user has through their group, in ONE query.
     *
     * @return array<string, true>
     */
    public function modulePermissions(): array
    {
        return $this->modulePermissionCache ??= UserGroupModuleAction::query()
            ->join('user_group_members as ugm', 'ugm.user_group_id', '=', 'user_group_module_actions.user_group_id')
            ->join('user_groups as ug', 'ug.id', '=', 'user_group_module_actions.user_group_id')
            ->join('system_sub_modules as ssm', 'ssm.id', '=', 'user_group_module_actions.system_sub_module_id')
            ->join('module_actions as ma', 'ma.id', '=', 'user_group_module_actions.module_action_id')
            ->where('ugm.user_id', $this->getKey())
            ->whereNull('ug.deleted_at')
            ->get(['ssm.name as sub_module', 'ma.name as action'])
            ->mapWithKeys(fn ($row) => ["{$row->sub_module}|{$row->action}" => true])
            ->all();
    }

    /**
     * Adds `priority`: 0 = member of this group, 1 = unassigned, 2 = member of another group.
     */
    public function scopeAnnotatedForGroup(Builder $query, int $groupId): Builder
    {
        $table = $this->getTable();

        return $query
            ->select("{$table}.*")
            ->selectRaw(
                // Soft-deleted groups are ignored, same as the userGroups relation.
                "CASE
                    WHEN EXISTS (SELECT 1 FROM user_group_members m WHERE m.user_id = {$table}.id AND m.user_group_id = ?) THEN 0
                    WHEN NOT EXISTS (
                        SELECT 1 FROM user_group_members m
                        JOIN user_groups g ON g.id = m.user_group_id AND g.deleted_at IS NULL
                        WHERE m.user_id = {$table}.id
                    ) THEN 1
                    ELSE 2
                 END AS priority",
                [$groupId]
            )
            // Qualified columns: the pivot also has an `id`, so a bare `id` would be ambiguous.
            ->with('userGroups:user_groups.id,user_groups.name');
    }
}
```

In `app/Models/User.php` add the trait:

```php
use App\Models\Concerns\HasUserGroups;

class User extends Authenticatable
{
    use HasFactory, Notifiable, SoftDeletes, Filterable, Searchable, Sortable;
    use HasUserGroups;
```

## 4. Names as constants

**`app/Constants/SubModules.php`**

```php
<?php

namespace App\Constants;

/**
 * system_sub_modules.name values. Use these instead of raw strings
 * (docs/core/permissions.md -> "Use Permission Constants or Enums").
 */
final class SubModules
{
    // Registrar
    public const STUDENT_MASTERLIST = 'Student Masterlist';
    public const COURSE_MASTERLIST = 'Course Masterlist';
    public const CURRICULUM_MANAGEMENT = 'Curriculum Management';
    public const TRANSCRIPT_OF_RECORDS = 'Transcript of Records';
    public const STUDENT_PROFILING = 'Student Profiling';
    public const REGISTRAR_CONFIGURATION = 'Registrar Configuration';

    // Admission
    public const ADMISSION_CONFIGURATION = 'Admission Configuration';
    public const APPLICATION_LIST = 'Application List';
    public const ADMISSION_LIMIT = 'Admission Limit';
    public const POOLING = 'Pooling';

    // Setup Manager
    public const CAMPUS_SETUP = 'Campus Setup';
    public const COLLEGE_SETUP = 'Institute/College Setup';
    public const PROGRAM_SETUP = 'Program Setup';
    public const DEPARTMENT_SETUP = 'Department Setup';
    public const ACADEMIC_YEAR_TERM_SETUP = 'Academic Year & Term Setup';
    public const ADMISSION_FORM_SETUP = 'Admission Form Setup';
    public const APPLICATION_TYPE = 'Application Type';

    // Security
    public const USER_MANAGEMENT = 'User Management';
    public const USER_GROUP_MANAGEMENT = 'User Group Management';
    public const ACCESS_RIGHTS = 'Access Rights';
    public const AUDIT_TRAILS = 'Audit Trails';
    public const EMPLOYEE_MANAGEMENT = 'Employee Management';

    // Online Admission
    public const ONLINE_ADMISSION = 'Online Admission';
}
```

**`app/Constants/ModuleActions.php`**

```php
<?php

namespace App\Constants;

/** module_actions.name values. */
final class ModuleActions
{
    public const VIEW = 'View';
    public const CREATE = 'Create';
    public const UPDATE = 'Update';
    public const DELETE = 'Delete';
    public const HARD_DELETE = 'Hard Delete';
    public const EXPORT = 'Export';
    public const IMPORT = 'Import';
    public const PRINT = 'Print';
    public const TAG = 'Tag';
    public const SYNC = 'Sync';
    public const RESET_DEFAULTS = 'Reset Defaults';
    public const ENABLE = 'Enable';
    public const DISABLE = 'Disable';
    public const APPROVE = 'Approve';
    public const REJECT = 'Reject';
    public const PUBLISH = 'Publish';
    public const CLOSE = 'Close';
    public const BLOCK = 'Block';
    public const UNBLOCK = 'Unblock';
    public const DUPLICATE = 'Duplicate';
    public const ACTIVATE = 'Activate';
    public const DEACTIVATE = 'Deactivate';
}
```

Add a constant whenever you add a sub-module. A typo in a constant name is an error; a typo in a string is a route nobody can open.

## 5. The permission middleware

**`app/Http/Middleware/ModulePermissionMiddleware.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Checks that the user's group may perform an action on a sub-module.
 * Runs after auth:api (API) or auth:web (Blade). Administrators bypass the check
 * (see HasUserGroups::isSuperUser).
 *
 *   ->middleware(['auth:api', ModulePermissionMiddleware::using(SubModules::ACCESS_RIGHTS, ModuleActions::UPDATE)])
 *   // same as 'module.permission:Access Rights,Update'
 */
class ModulePermissionMiddleware
{
    public const ALIAS = 'module.permission';

    public static function using(string $subModule, string $action): string
    {
        return self::ALIAS . ":{$subModule},{$action}";
    }

    public function handle(Request $request, Closure $next, string $subModule, string $action): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Same rule as CheckRoleMiddleware.
        if ($user->trashed()) {
            return response()->json([
                'success' => false,
                'message' => 'User Disabled',
            ], 403);
        }

        if (!$user->hasModulePermission($subModule, $action)) {
            $message = "You do not have permission to {$action} {$subModule}.";

            // Blade pages get the normal 403 error page; the API gets JSON.
            if (!$request->is('api/*') && !$request->expectsJson()) {
                abort(403, $message);
            }

            return response()->json(['success' => false, 'message' => $message], 403);
        }

        return $next($request);
    }
}
```

Register the alias in `bootstrap/app.php`:

```php
$middleware->alias([
    'role' => \App\Http\Middleware\CheckRoleMiddleware::class,
    'module.permission' => \App\Http\Middleware\ModulePermissionMiddleware::class,
]);
```

## 6. Seed the permissions

All permission data lives in **one file**; the seeders are generic.

::: details database/seeders/data/rbac.php
**`database/seeders/data/rbac.php`**

```php
<?php

/*
|--------------------------------------------------------------------------
| RBAC seed data
|--------------------------------------------------------------------------
| Single source of truth for every RBAC seeder. To add a module, action,
| group, or permission, edit THIS file only — the seeders are generic.
|
| Sub-module actions:
|   'Sub Module' => ['View', 'Create']                 description = "View Sub Module"
|   'Sub Module' => ['Reset Defaults' => 'Custom text'] description override
|
| Group permissions (expanded against the sub-module action catalogue):
|   '*'                                         every action on every sub-module
|   ['Registrar' => '*']                        every action in a module
|   ['Registrar' => ['Student Masterlist' => '*']]              whole sub-module
|   ['Registrar' => ['Student Masterlist' => ['View', 'Export']]]  specific actions
*/

return [

    // ------------------------------------------------------------------
    // module_actions
    // ------------------------------------------------------------------
    'module_actions' => [
        'View', 'Create', 'Update', 'Delete', 'Hard Delete', 'Export', 'Import',
        'Print', 'Tag', 'Sync', 'Reset Defaults', 'Enable', 'Disable', 'Approve',
        'Reject', 'Publish', 'Close', 'Block', 'Unblock', 'Duplicate', 'Activate',
        'Deactivate',
    ],

    // ------------------------------------------------------------------
    // system_modules -> system_sub_modules -> system_sub_modules_actions
    // (array order = module_order, starting at 1)
    // ------------------------------------------------------------------
    'modules' => [
        'Registrar' => [
            'Student Masterlist'      => ['View', 'Create', 'Update', 'Delete', 'Import', 'Print', 'Export'],
            'Course Masterlist'       => ['View', 'Create', 'Update', 'Delete', 'Print', 'Export'],
            'Curriculum Management'   => ['View', 'Create', 'Update', 'Delete', 'Tag', 'Print', 'Export'],
            'Transcript of Records'   => ['View', 'Update', 'Print', 'Export'],
            'Student Profiling'       => ['View', 'Create', 'Update', 'Delete'],
            'Registrar Configuration' => ['View', 'Update', 'Reset Defaults' => 'Reset Registrar Configuration', 'Export'],
        ],
        'Admission' => [
            'Admission Configuration' => ['View', 'Update', 'Enable', 'Disable', 'Publish'],
            'Application List'        => ['View', 'Create', 'Update', 'Delete', 'Export', 'Print', 'Approve', 'Reject'],
            'Admission Limit'         => ['View', 'Update'],
            'Pooling'                 => ['View', 'Delete', 'Approve', 'Reject', 'Export', 'Print'],
        ],
        'Setup Manager' => [
            'Campus Setup'               => ['View', 'Create', 'Update', 'Delete'],
            'Institute/College Setup'    => ['View', 'Create', 'Update', 'Delete'],
            'Program Setup'              => ['View', 'Create', 'Update', 'Delete'],
            'Department Setup'           => ['View', 'Create', 'Update', 'Delete'],
            'Academic Year & Term Setup' => ['View', 'Create', 'Update', 'Delete'],
            'Admission Form Setup'       => ['View', 'Create', 'Update', 'Delete', 'Duplicate'],
            'Application Type'           => ['View', 'Update', 'Close'],
        ],
        'Security' => [
            'User Management'       => ['View', 'Update', 'Activate', 'Deactivate', 'Block', 'Unblock'],
            'User Group Management' => ['View', 'Create', 'Update', 'Delete', 'Sync'],
            'Access Rights'         => ['View', 'Update'],
            'Audit Trails'          => ['View', 'Delete', 'Export', 'Print'],
            'Employee Management'   => ['View', 'Create', 'Update', 'Delete', 'Export', 'Print'],
        ],
        'Online Admission' => [
            'Online Admission' => ['View', 'Create', 'Update', 'Delete', 'Export', 'Import', 'Print'],
        ],
    ],

    // ------------------------------------------------------------------
    // user_groups + user_group_module_actions
    // Example groups. Replace them with your organisation's groups.
    // ------------------------------------------------------------------
    'user_groups' => [
        'Super Admin' => [
            'description' => 'Full access to all modules, actions, security, and system settings',
            'permissions' => '*',
        ],
        'Administrator' => [
            'description' => 'Full administrative controls across all system modules',
            'permissions' => '*',
        ],
        'Registrar' => [
            'description' => 'Registrar records and the academic setup screens',
            'permissions' => [
                'Registrar' => '*',
                'Setup Manager' => [
                    'Campus Setup' => ['View'],
                    'Program Setup' => ['View'],
                    'Academic Year & Term Setup' => ['View', 'Create', 'Update'],
                ],
            ],
        ],
        'Admission' => [
            'description' => 'Admission and online admission screens',
            'permissions' => [
                'Admission' => '*',
                'Online Admission' => '*',
            ],
        ],
        'HR' => [
            'description' => 'Employee records and user account controls',
            'permissions' => [
                'Security' => [
                    'Employee Management' => '*',
                    'User Management' => ['View', 'Update', 'Activate', 'Deactivate'],
                    'Audit Trails' => ['View'],
                ],
            ],
        ],
        'Viewer' => [
            'description' => 'Read-only access to the setup screens',
            'permissions' => [
                'Setup Manager' => [
                    'Campus Setup' => ['View'],
                    'Program Setup' => ['View'],
                ],
            ],
        ],
    ],

    // ------------------------------------------------------------------
    // user_role_default_group   (user_roles.name => user_groups.name)
    // Roles come from UserRoleSeeder ("Admin", "Staff").
    // Add a line here for every role you add; unknown roles are skipped with a warning.
    // ------------------------------------------------------------------
    'role_default_groups' => [
        'Admin' => 'Super Admin',
        // 'Staff' => 'Administrator',   // uncomment once Staff should get a default group
    ],

    // ------------------------------------------------------------------
    // user_group_members   (users.email => user_groups.name)
    // Members are matched by email.
    // admin@email.com (UserSeeder, id 1) must stay in Super Admin (group 1).
    // ------------------------------------------------------------------
    'group_members' => [
        'admin@email.com' => 'Super Admin',
    ],
];
```

:::

The expander that turns `'*'` and module/sub-module patterns into rows, and stops on typos:

**`app/Support/Rbac/PermissionMatrix.php`**

```php
<?php

namespace App\Support\Rbac;

use InvalidArgumentException;

/**
 * Pure (DB-free) helpers that turn the compact data in
 * database/seeders/data/rbac.php into flat rows.
 */
final class PermissionMatrix
{
    /**
     * Flatten the modules tree into the sub-module action catalogue.
     *
     * @return list<array{module:string, sub_module:string, action:string, description:string}>
     */
    public static function catalogue(array $modules): array
    {
        $rows = [];

        foreach ($modules as $module => $subModules) {
            foreach ($subModules as $subModule => $actions) {
                foreach ($actions as $key => $value) {
                    [$action, $description] = is_int($key)
                        ? [$value, "{$value} {$subModule}"]
                        : [$key, $value];

                    $rows[] = compact('module', 'action', 'description') + ['sub_module' => $subModule];
                }
            }
        }

        return $rows;
    }

    /**
     * Expand a group's permission spec into [module, sub_module, action] triples.
     * Every triple is validated against the catalogue, so a group can never be
     * granted an action that the sub-module does not offer.
     *
     * @return list<array{module:string, sub_module:string, action:string}>
     */
    public static function expand(array $modules, string|array $spec): array
    {
        $available = self::availableActions($modules);

        if ($spec === '*') {
            $spec = array_fill_keys(array_keys($available), '*');
        }

        if (! is_array($spec)) {
            throw new InvalidArgumentException("Invalid permission spec '{$spec}'. Use '*' or an array.");
        }

        $triples = [];

        foreach ($spec as $module => $subSpec) {
            if (! isset($available[$module])) {
                throw new InvalidArgumentException("Unknown system module '{$module}'.");
            }

            if ($subSpec === '*') {
                $subSpec = array_fill_keys(array_keys($available[$module]), '*');
            }

            foreach ($subSpec as $subModule => $actions) {
                if (! isset($available[$module][$subModule])) {
                    throw new InvalidArgumentException("Unknown sub-module '{$module} > {$subModule}'.");
                }

                $offered = $available[$module][$subModule];
                $actions = $actions === '*' ? $offered : (array) $actions;

                foreach ($actions as $action) {
                    if (! in_array($action, $offered, true)) {
                        throw new InvalidArgumentException(
                            "Action '{$action}' is not offered by '{$module} > {$subModule}'."
                        );
                    }

                    $triples["{$module}|{$subModule}|{$action}"] = [
                        'module' => $module,
                        'sub_module' => $subModule,
                        'action' => $action,
                    ];
                }
            }
        }

        return array_values($triples);
    }

    /** @return array<string, array<string, list<string>>> module => sub_module => actions */
    private static function availableActions(array $modules): array
    {
        $map = [];

        foreach (self::catalogue($modules) as $row) {
            $map[$row['module']][$row['sub_module']][] = $row['action'];
        }

        return $map;
    }
}
```


::: details Generic seeders (database/seeders/Rbac and RbacSeeder)
**`database/seeders/Rbac/BaseRbacSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

/**
 * Shared plumbing for every RBAC seeder:
 *  - loads database/seeders/data/rbac.php once
 *  - idempotent firstOrCreate / updateOrCreate with [+] / [-] console output
 *  - created / existing / skipped summary
 */
abstract class BaseRbacSeeder extends Seeder
{
    private static ?array $data = null;

    protected int $created = 0;
    protected int $existing = 0;
    protected int $skipped = 0;

    /** Human label shown in console output, e.g. "Module Actions". */
    abstract protected function label(): string;

    /** Do the actual seeding. */
    abstract protected function seed(): void;

    public function run(): void
    {
        $this->created = $this->existing = $this->skipped = 0;

        $this->command?->info("Seeding {$this->label()}...");
        $this->seed();
        $this->command?->info(sprintf(
            '  %s done (created: %d, existing: %d, skipped: %d)',
            $this->label(), $this->created, $this->existing, $this->skipped,
        ));
    }

    protected function data(?string $key = null): mixed
    {
        self::$data ??= require database_path('seeders/data/rbac.php');

        return $key === null ? self::$data : (self::$data[$key] ?? []);
    }

    /**
     * @param  class-string<Model>  $model
     */
    protected function upsert(string $model, array $match, array $values = [], bool $update = false): Model
    {
        $record = $update
            ? $model::query()->updateOrCreate($match, $values)
            : $model::query()->firstOrCreate($match, $values);

        $label = implode(' / ', array_map('strval', array_values($match + $values)));

        if ($record->wasRecentlyCreated) {
            $this->created++;
            $this->command?->line("  <fg=green>[+]</> {$label}");
        } else {
            $this->existing++;
            $this->command?->line("  <fg=gray>[-]</> {$label} (exists)");
        }

        return $record;
    }

    protected function skip(string $reason): void
    {
        $this->skipped++;
        $this->command?->warn("  [!] Skipped: {$reason}");
    }
}
```

**`database/seeders/Rbac/ResolvesRbacIds.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\ModuleAction;
use App\Models\SystemSubModule;
use App\Models\UserGroup;

/**
 * Name -> id lookups, loaded once per seeder run (avoids N+1 queries).
 */
trait ResolvesRbacIds
{
    private ?array $subModuleIds = null;
    private ?array $actionIds = null;
    private ?array $groupIds = null;

    protected function subModuleId(string $module, string $subModule): ?int
    {
        $this->subModuleIds ??= SystemSubModule::query()
            ->with('systemModule:id,name')
            ->get()
            ->mapWithKeys(fn ($s) => ["{$s->systemModule->name}|{$s->name}" => $s->id])
            ->all();

        return $this->subModuleIds["{$module}|{$subModule}"] ?? null;
    }

    protected function actionId(string $action): ?int
    {
        $this->actionIds ??= ModuleAction::query()->pluck('id', 'name')->all();

        return $this->actionIds[$action] ?? null;
    }

    protected function groupId(string $group): ?int
    {
        $this->groupIds ??= UserGroup::query()->pluck('id', 'name')->all();

        return $this->groupIds[$group] ?? null;
    }
}
```

**`database/seeders/Rbac/ModuleActionSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\ModuleAction;

class ModuleActionSeeder extends BaseRbacSeeder
{
    protected function label(): string
    {
        return 'Module Actions';
    }

    protected function seed(): void
    {
        foreach ($this->data('module_actions') as $name) {
            $this->upsert(ModuleAction::class, ['name' => $name]);
        }
    }
}
```

**`database/seeders/Rbac/SystemModuleSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\SystemModule;

class SystemModuleSeeder extends BaseRbacSeeder
{
    protected function label(): string
    {
        return 'System Modules';
    }

    protected function seed(): void
    {
        $order = 1;

        foreach (array_keys($this->data('modules')) as $name) {
            $this->upsert(SystemModule::class, ['name' => $name], ['module_order' => $order++], update: true);
        }
    }
}
```

**`database/seeders/Rbac/SystemSubModuleSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\SystemModule;
use App\Models\SystemSubModule;

class SystemSubModuleSeeder extends BaseRbacSeeder
{
    protected function label(): string
    {
        return 'System Sub Modules';
    }

    protected function seed(): void
    {
        foreach ($this->data('modules') as $moduleName => $subModules) {
            $module = SystemModule::query()->where('name', $moduleName)->first();

            if (! $module) {
                $this->skip("system module '{$moduleName}' not found");
                continue;
            }

            $order = 1;

            foreach (array_keys($subModules) as $name) {
                $this->upsert(
                    SystemSubModule::class,
                    ['name' => $name, 'system_module_id' => $module->id],
                    ['module_order' => $order++],
                    update: true,
                );
            }
        }
    }
}
```

**`database/seeders/Rbac/SystemSubModuleActionSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\ModuleAction;
use App\Models\SystemSubModuleAction;
use App\Support\Rbac\PermissionMatrix;

class SystemSubModuleActionSeeder extends BaseRbacSeeder
{
    use ResolvesRbacIds;

    protected function label(): string
    {
        return 'System Sub Module Actions';
    }

    protected function seed(): void
    {
        foreach (PermissionMatrix::catalogue($this->data('modules')) as $row) {
            $subModuleId = $this->subModuleId($row['module'], $row['sub_module']);
            $actionId = $this->actionId($row['action']);

            if (! $subModuleId || ! $actionId) {
                $this->skip("{$row['module']} > {$row['sub_module']} > {$row['action']} (missing sub-module or action)");
                continue;
            }

            $this->upsert(
                SystemSubModuleAction::class,
                ['system_sub_module_id' => $subModuleId, 'module_action_id' => $actionId],
                ['description' => $row['description']],
                update: true,
            );
        }
    }
}
```

**`database/seeders/Rbac/UserGroupSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\UserGroup;

class UserGroupSeeder extends BaseRbacSeeder
{
    protected function label(): string
    {
        return 'User Groups';
    }

    protected function seed(): void
    {
        foreach ($this->data('user_groups') as $name => $group) {
            $this->upsert(
                UserGroup::class,
                ['name' => $name],
                ['description' => $group['description'] ?? ''],
                update: true,
            );
        }
    }
}
```

**`database/seeders/Rbac/UserGroupModuleActionSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\UserGroupModuleAction;
use App\Support\Rbac\PermissionMatrix;

/**
 * Additive: grants listed permissions and never
 * removes permissions an admin added later through "Access Rights".
 */
class UserGroupModuleActionSeeder extends BaseRbacSeeder
{
    use ResolvesRbacIds;

    protected function label(): string
    {
        return 'User Group Module Actions';
    }

    protected function seed(): void
    {
        $modules = $this->data('modules');

        foreach ($this->data('user_groups') as $groupName => $group) {
            $groupId = $this->groupId($groupName);

            if (! $groupId) {
                $this->skip("user group '{$groupName}' not found");
                continue;
            }

            // Throws on unknown module / sub-module / action -> fails fast on typos.
            $triples = PermissionMatrix::expand($modules, $group['permissions'] ?? []);

            foreach ($triples as $t) {
                $subModuleId = $this->subModuleId($t['module'], $t['sub_module']);
                $actionId = $this->actionId($t['action']);

                if (! $subModuleId || ! $actionId) {
                    $this->skip("{$groupName}: {$t['module']} > {$t['sub_module']} > {$t['action']}");
                    continue;
                }

                $this->upsert(UserGroupModuleAction::class, [
                    'user_group_id' => $groupId,
                    'system_sub_module_id' => $subModuleId,
                    'module_action_id' => $actionId,
                ]);
            }
        }
    }
}
```

**`database/seeders/Rbac/UserRoleDefaultGroupSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\UserRole;
use App\Models\UserRoleDefaultGroup;

class UserRoleDefaultGroupSeeder extends BaseRbacSeeder
{
    use ResolvesRbacIds;

    protected function label(): string
    {
        return 'User Role Default Groups';
    }

    protected function seed(): void
    {
        $roleIds = UserRole::query()->pluck('id', 'name')->all();

        foreach ($this->data('role_default_groups') as $roleName => $groupName) {
            $roleId = $roleIds[$roleName] ?? null;
            $groupId = $this->groupId($groupName);

            if (! $roleId || ! $groupId) {
                $this->skip("{$roleName} -> {$groupName} (role or group not found)");
                continue;
            }

            $this->upsert(UserRoleDefaultGroup::class, [
                'user_role_id' => $roleId,
                'user_group_id' => $groupId,
            ]);
        }
    }
}
```

**`database/seeders/Rbac/UserGroupMemberSeeder.php`**

```php
<?php

namespace Database\Seeders\Rbac;

use App\Models\User;
use App\Models\UserGroupMember;

/**
 * Dev/test memberships. Enforces the "one user = one group" convention:
 * a user already in another group is skipped, not moved.
 */
class UserGroupMemberSeeder extends BaseRbacSeeder
{
    use ResolvesRbacIds;

    /** Column used to find users. */
    protected string $userKey = 'email';

    protected function label(): string
    {
        return 'User Group Members';
    }

    protected function seed(): void
    {
        $members = $this->data('group_members');

        $userIds = User::query()
            ->whereIn($this->userKey, array_keys($members))
            ->pluck('id', $this->userKey)
            ->all();

        foreach ($members as $userKey => $groupName) {
            $userId = $userIds[$userKey] ?? null;
            $groupId = $this->groupId($groupName);

            if (! $userId || ! $groupId) {
                $this->skip("{$userKey} -> {$groupName} (user or group not found)");
                continue;
            }

            $otherGroup = UserGroupMember::query()
                ->where('user_id', $userId)
                ->where('user_group_id', '!=', $groupId)
                ->exists();

            if ($otherGroup) {
                $this->skip("{$userKey} already belongs to another group");
                continue;
            }

            $this->upsert(UserGroupMember::class, [
                'user_id' => $userId,
                'user_group_id' => $groupId,
            ]);
        }
    }
}
```

**`database/seeders/RbacSeeder.php`**

```php
<?php

namespace Database\Seeders;

use Database\Seeders\Rbac\ModuleActionSeeder;
use Database\Seeders\Rbac\SystemModuleSeeder;
use Database\Seeders\Rbac\SystemSubModuleActionSeeder;
use Database\Seeders\Rbac\SystemSubModuleSeeder;
use Database\Seeders\Rbac\UserGroupMemberSeeder;
use Database\Seeders\Rbac\UserGroupModuleActionSeeder;
use Database\Seeders\Rbac\UserGroupSeeder;
use Database\Seeders\Rbac\UserRoleDefaultGroupSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Runs every RBAC seeder in foreign-key order inside one transaction.
 *
 *   php artisan db:seed --class=RbacSeeder
 *   php artisan db:seed --class="Database\Seeders\Rbac\UserGroupModuleActionSeeder"
 */
class RbacSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(fn () => $this->call([
            SystemModuleSeeder::class,
            SystemSubModuleSeeder::class,
            ModuleActionSeeder::class,
            SystemSubModuleActionSeeder::class,
            UserGroupSeeder::class,
            UserGroupModuleActionSeeder::class,
            UserRoleDefaultGroupSeeder::class,
            UserGroupMemberSeeder::class, // needs users + user_roles seeded first
        ]));
    }
}
```

:::

Add it to `DatabaseSeeder`:

**`database/seeders/DatabaseSeeder.php`**

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserRoleSeeder::class,
            UserSeeder::class,
            RbacSeeder::class, // added in foundation 10; needs roles and users
        ]);
    }
}
```

How to add permissions for a new feature: [Seeding permissions](/guides/seeding-rbac).

## 7. Send permissions to the frontend at login

The frontend needs the user's permissions to show or hide menus and buttons:

**`app/Http/Resources/v1/modules/auth/UserWithPermissionsResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\auth;

use App\Models\SystemSubModuleAction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * MeResource fields + the user's group and module permissions, so the frontend
 * can build menus/buttons right after login or on app start (?include_user=1).
 */
class UserWithPermissionsResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return array_merge((new MeResource($this->resource))->toArray($request), [
            'user_group' => $this->userGroup()?->only(['id', 'name']),
            'is_superuser' => $this->isSuperUser(),
            // { "Access Rights": ["View", "Update"], ... }
            'permissions' => $this->permissionMap(),
        ]);
    }

    private function permissionMap(): array
    {
        $keys = $this->isSuperUser()
            ? SystemSubModuleAction::query()
                ->join('system_sub_modules as ssm', 'ssm.id', '=', 'system_sub_modules_actions.system_sub_module_id')
                ->join('module_actions as ma', 'ma.id', '=', 'system_sub_modules_actions.module_action_id')
                ->get(['ssm.name as sub_module', 'ma.name as action'])
                ->map(fn ($row) => "{$row->sub_module}|{$row->action}")
                ->all()
            : array_keys($this->modulePermissions());

        $map = [];
        foreach ($keys as $key) {
            [$subModule, $action] = explode('|', $key, 2);
            $map[$subModule][] = $action;
        }

        return $map;
    }
}
```

In `AuthController`, use it in `login()` and `refreshToken()` instead of `MeResource` (import `App\Http\Resources\v1\modules\auth\UserWithPermissionsResource`):

```php
'user' => UserWithPermissionsResource::make($user),
// and in refreshToken():
$data['user'] = UserWithPermissionsResource::make($tokens->user());
```

## 8. The user group module

The screens to manage groups, members and permissions are a normal module built with the pattern from [Creating a module](/guides/creating-a-module). Copy these files:

::: details Requests
**`app/Http/Requests/UserGroupRequest.php`**

```php
<?php

namespace App\Http\Requests;

use App\Http\Resources\GlobalResponseResource;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/** Create (POST) / update (PATCH) a user group. PATCH makes every field optional. */
class UserGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        $required = $this->isMethod('patch') ? 'sometimes' : 'required';

        return [
            // @example Scholarship Office
            'name' => [
                $required, 'string', 'max:255',
                Rule::unique('user_groups', 'name')
                    ->ignore($this->route('id'))
                    ->whereNull('deleted_at'),
            ],
            // @example Access to scholarship screens
            'description' => [$required, 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'User group name is required.',
            'name.unique' => 'A user group with this name already exists.',
            'description.required' => 'User group description is required.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        $response = [
            'success' => false,
            'message' => $validator->errors()->first(),
        ];

        $resource = new GlobalResponseResource((object) $response);

        throw new HttpResponseException(response()->json($resource, 422));
    }
}
```

**`app/Http/Requests/UserGroupMemberRequest.php`**

```php
<?php

namespace App\Http\Requests;

use App\Http\Resources\GlobalResponseResource;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/** { "user_ids": [1, 2, 3] } — the full member list; [] removes everyone. */
class UserGroupMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'user_ids.present' => 'The user_ids list is required (send [] to remove all members).',
            'user_ids.*.exists' => 'One or more selected users no longer exist.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        $response = [
            'success' => false,
            'message' => $validator->errors()->first(),
        ];

        $resource = new GlobalResponseResource((object) $response);

        throw new HttpResponseException(response()->json($resource, 422));
    }
}
```

**`app/Http/Requests/UserGroupPermissionRequest.php`**

```php
<?php

namespace App\Http\Requests;

use App\Http\Resources\GlobalResponseResource;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * { "permissions": [ { "system_sub_module": 1, "module_action": 2 }, ... ] }
 * *_id keys are accepted too. [] removes every permission from the group.
 */
class UserGroupPermissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    protected function prepareForValidation(): void
    {
        $permissions = $this->input('permissions');

        if (!is_array($permissions)) {
            return;
        }

        $this->merge([
            'permissions' => array_map(fn ($p) => is_array($p) ? [
                'system_sub_module' => $p['system_sub_module'] ?? $p['system_sub_module_id'] ?? null,
                'module_action' => $p['module_action'] ?? $p['module_action_id'] ?? null,
            ] : $p, $permissions),
        ]);
    }

    public function rules(): array
    {
        return [
            'permissions' => ['present', 'array'],
            'permissions.*' => ['array'],
            'permissions.*.system_sub_module' => ['required', 'integer', 'exists:system_sub_modules,id'],
            'permissions.*.module_action' => ['required', 'integer', 'exists:module_actions,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'permissions.present' => 'The permissions list is required (send [] to remove all permissions).',
            'permissions.*.system_sub_module.exists' => 'One or more selected sub-modules do not exist.',
            'permissions.*.module_action.exists' => 'One or more selected actions do not exist.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        $response = [
            'success' => false,
            'message' => $validator->errors()->first(),
        ];

        $resource = new GlobalResponseResource((object) $response);

        throw new HttpResponseException(response()->json($resource, 422));
    }
}
```

:::

::: details Resources
**`app/Http/Resources/v1/modules/userGroup/UserGroupResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\userGroup;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserGroupResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
        ];
    }
}
```

**`app/Http/Resources/v1/modules/userGroup/UserGroupListResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\userGroup;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserGroupListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'members_count' => (int) $this->members_count,
            'active_modules_count' => (int) $this->active_modules_count,
            'active_modules_actions_count' => (int) $this->active_modules_actions_count,
        ];
    }
}
```

**`app/Http/Resources/v1/modules/userGroup/UserGroupMemberResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\userGroup;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserGroupMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => "{$this->first_name} {$this->last_name}",
            'email' => $this->email,
            'assigned_group' => $this->userGroups->first()?->name,
            // 0 = in this group, 1 = unassigned, 2 = in another group
            'priority' => (int) $this->priority,
        ];
    }
}
```

:::

::: details Services
**`app/Services/v1/modules/UserGroupService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Helpers\ActivityLogHelper;
use App\Models\User;
use App\Models\UserGroup;
use App\Models\UserGroupModuleAction;
use Illuminate\Database\Eloquent\Builder;

/**
 * User group CRUD, the filtered list and the summary cards.
 */
class UserGroupService
{
    /** Group #1 is the protected Super Admin group (hidden from the filtered list). */
    public const SUPERADMIN_GROUP_ID = 1;

    public function __construct()
    {
        // Constructor logic if needed
    }

    /**
     * Paginated groups with member / module / action counts.
     * Params: per_page, page, search, name, so ("i|n,asc|desc").
     */
    public function viewUserGroupsService($request)
    {
        return $this->paginate($this->annotatedQuery(), $request);
    }

    /** Same as viewUserGroupsService() without the Super Admin group. */
    public function viewFilteredUserGroupsService($request)
    {
        return $this->paginate(
            $this->annotatedQuery()->where('user_groups.id', '!=', self::SUPERADMIN_GROUP_ID),
            $request
        );
    }

    /**
     * "Personnel" = every active (not soft-deleted) user except the seeded admin (id 1),
     * same exclusion UserService uses. Narrow further here if you add a user type.
     */
    public function userGroupStatsService()
    {
        $personnel = fn (): Builder => User::query()->where('id', '!=', 1);

        return (object) [
            'success' => true,
            'message' => 'User groups cards retrieved successfully',
            'data' => [
                'total_user_groups' => UserGroup::count(),
                'total_assigned_personnel' => $personnel()->whereHas('userGroups')->count(),
                'total_unassigned_personnel' => $personnel()->whereDoesntHave('userGroups')->count(),
            ],
        ];
    }

    public function getUserGroupService($id)
    {
        return (object) [
            'success' => true,
            'message' => 'User group retrieved successfully',
            'data' => UserGroup::findOrFail($id),
        ];
    }

    public function createUserGroupService(array $data)
    {
        $group = UserGroup::create([
            'name' => $data['name'],
            'description' => $data['description'],
        ]);

        $response = (object) [
            'success' => true,
            'message' => "User group '{$group->name}' created successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'user_group',
            'event' => 'create',
            'message' => "Created user group '{$group->name}' (ID: #{$group->id}).",
            'changes' => $group->toArray(),
            'payload' => $data,
            'response' => $response,
            'subject' => $group,
        ]);

        return $response;
    }

    public function updateUserGroupService(array $data)
    {
        $group = UserGroup::findOrFail($data['id']);

        $group->fill(array_intersect_key($data, array_flip(['name', 'description'])));

        if (!$group->isDirty()) {
            return (object) [
                'success' => true,
                'message' => "No changes made to user group '{$group->name}'.",
            ];
        }

        $group->save();

        $response = (object) [
            'success' => true,
            'message' => "User group '{$group->name}' (ID: #{$group->id}) updated successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'user_group',
            'event' => 'update',
            'message' => "User group '{$group->name}' (ID: #{$group->id}) details were updated.",
            'changes' => $group->getChanges(),
            'payload' => $data,
            'response' => $response,
            'subject' => $group,
        ]);

        return $response;
    }

    /**
     * Soft delete. UserGroup's deleting hook throws InvalidException while the group
     * still has members or is a role's default group.
     */
    public function deleteUserGroupService($id)
    {
        $group = UserGroup::findOrFail($id);
        $group->delete();

        $response = (object) [
            'success' => true,
            'message' => "User group '{$group->name}' deleted successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'user_group',
            'event' => 'delete',
            'message' => "User group '{$group->name}' (ID: #{$id}) was successfully deleted.",
            'changes' => [],
            'payload' => ['id' => $id],
            'response' => $response,
            'subject' => $group,
        ]);

        return $response;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /** Groups with member, module and action counts computed in SQL. */
    private function annotatedQuery(): Builder
    {
        $distinctCount = fn (string $column) => UserGroupModuleAction::query()
            ->selectRaw("COUNT(DISTINCT {$column})")
            ->whereColumn('user_group_module_actions.user_group_id', 'user_groups.id');

        return UserGroup::query()
            ->select('user_groups.*')
            ->withCount('users as members_count')
            ->addSelect([
                'active_modules_count' => $distinctCount('system_sub_module_id'),
                'active_modules_actions_count' => $distinctCount('module_action_id'),
            ]);
    }

    private function paginate(Builder $query, $request)
    {
        $params = $request->all();

        [$key, $direction] = array_pad(explode(',', strtolower((string) ($params['so'] ?? '')), 2), 2, '');

        return $query->applySearch($params)
            ->applyFilterBy($params)
            ->when(in_array($key, ['i', 'n'], true), fn ($q) => $q->applySort("{$key}," . (trim($direction) === 'desc' ? 'desc' : 'asc')))
            // Tie-breaker so rows never shift between pages.
            ->orderBy('user_groups.id')
            ->paginate($request['per_page'] ?? 10, ['*'], 'page', $request['page'] ?? 1);
    }
}
```

**`app/Services/v1/modules/UserGroupMemberService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Exceptions\InvalidException;
use App\Helpers\ActivityLogHelper;
use App\Models\User;
use App\Models\UserGroup;
use Illuminate\Support\Facades\DB;

/**
 * Lists users ranked for a group and replaces a group's members.
 */
class UserGroupMemberService
{
    /** The seeded admin account (UserSeeder), which must never leave the Super Admin group. */
    public const SUPERADMIN_USER_ID = 1;

    public function __construct()
    {
        // Constructor logic if needed
    }

    /**
     * Every user ranked for this group: its members first, then unassigned users,
     * then users already in another group.
     * Params: per_page, page, search (email, first name, last name).
     */
    public function viewUserGroupMembersService($request, $id)
    {
        $group = UserGroup::findOrFail($id);
        $search = trim((string) ($request['search'] ?? ''));

        return User::query()
            ->annotatedForGroup($group->id)
            ->when($search !== '', fn ($q) => $q->where(fn ($sub) => $sub
                ->where('email', 'like', "%{$search}%")
                ->orWhere('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")))
            ->orderBy('priority')
            ->orderBy('email')
            ->orderBy('id')
            ->paginate($request['per_page'] ?? 10, ['*'], 'page', $request['page'] ?? 1);
    }

    /**
     * Replaces the group's members with user_ids (attach new, detach missing).
     * $data = ['id' => group id, 'user_ids' => [...]]
     */
    public function syncUserGroupMembersService(array $data)
    {
        $group = UserGroup::findOrFail($data['id']);
        $userIds = array_values(array_unique(array_map('intval', $data['user_ids'])));

        if ($group->id === UserGroupService::SUPERADMIN_GROUP_ID && !in_array(self::SUPERADMIN_USER_ID, $userIds, true)) {
            throw new InvalidException('The superadmin user must remain in Group 1 and cannot be removed.');
        }

        // A user can only belong to one user group.
        $conflicts = User::whereIn('id', $userIds)
            ->whereHas('userGroups', fn ($q) => $q->where('user_groups.id', '!=', $group->id))
            ->pluck('email');

        if ($conflicts->isNotEmpty()) {
            throw new InvalidException(
                "The following user(s) are already assigned to another group: {$conflicts->implode(', ')}. "
                . 'A user can only belong to 1 user group.'
            );
        }

        $changes = DB::transaction(fn () => $group->users()->sync($userIds));

        $response = (object) [
            'success' => true,
            'message' => "User group '{$group->name}' (ID: #{$group->id}) members updated successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'user_group',
            'event' => 'update members',
            'message' => "Updated members for user group '{$group->name}' (ID: #{$group->id}). Total member records synced: " . count($userIds) . '.',
            'changes' => [
                'attached' => $changes['attached'],
                'detached' => $changes['detached'],
            ],
            'payload' => $data,
            'response' => $response,
            'subject' => $group,
        ]);

        return $response;
    }
}
```

**`app/Services/v1/modules/UserGroupPermissionService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Exceptions\InvalidException;
use App\Helpers\ActivityLogHelper;
use App\Models\SystemSubModuleAction;
use App\Models\UserGroup;
use App\Models\UserGroupModuleAction;
use Illuminate\Support\Facades\DB;

/**
 * A group's permissions: the Module > Sub-module > Action tree with an
 * is_assigned flag, and a set-based sync that writes only the differences.
 */
class UserGroupPermissionService
{
    public function __construct()
    {
        // Constructor logic if needed
    }

    /**
     * Module -> Sub-module -> Actions tree with an is_assigned flag.
     */
    public function getUserGroupPermissionsService($id)
    {
        $group = UserGroup::findOrFail($id);

        $assigned = $group->permissions()
            ->get(['system_sub_module_id', 'module_action_id'])
            ->mapWithKeys(fn ($p) => [self::key($p->system_sub_module_id, $p->module_action_id) => true])
            ->all();

        return (object) [
            'success' => true,
            'message' => 'User group permissions retrieved successfully',
            'data' => [
                'id' => $group->id,
                'name' => $group->name,
                'description' => $group->description,
                'system_modules' => self::buildTree($this->catalogue(), $assigned),
            ],
        ];
    }

    /**
     * Set-based sync: only the difference is written (bulk delete + bulk insert).
     * $data = ['id' => group id, 'permissions' => [['system_sub_module' => 1, 'module_action' => 2], ...]]
     */
    public function syncUserGroupPermissionsService(array $data)
    {
        $group = UserGroup::findOrFail($data['id']);
        $permissions = $data['permissions'];

        $incoming = [];
        foreach ($permissions as $p) {
            $incoming[self::key($p['system_sub_module'], $p['module_action'])] = true;
        }

        $this->guardAgainstCatalogue(array_keys($incoming));

        $result = DB::transaction(function () use ($group, $incoming) {
            // "subId|actionId" => permission row id
            $existing = $group->permissions()
                ->get(['id', 'system_sub_module_id', 'module_action_id'])
                ->mapWithKeys(fn ($p) => [self::key($p->system_sub_module_id, $p->module_action_id) => $p->id])
                ->all();

            ['create' => $toCreate, 'delete' => $toDelete] = self::diff($existing, array_keys($incoming));

            if ($toDelete !== []) {
                UserGroupModuleAction::query()->whereKey($toDelete)->delete();
            }

            if ($toCreate !== []) {
                UserGroupModuleAction::query()->insert(array_map(function (string $key) use ($group) {
                    [$subId, $actionId] = array_map('intval', explode('|', $key));

                    return [
                        'user_group_id' => $group->id,
                        'system_sub_module_id' => $subId,
                        'module_action_id' => $actionId,
                    ];
                }, $toCreate));
            }

            return [
                'created' => count($toCreate),
                'deleted' => count($toDelete),
                'unchanged' => count($existing) - count($toDelete),
            ];
        });

        $response = (object) [
            'success' => true,
            'message' => "User group '{$group->name}' (ID: #{$group->id}) permissions updated successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'user_group',
            'event' => 'update permissions',
            'message' => "Updated action access permissions for user group '{$group->name}' (ID: #{$group->id}).",
            'changes' => $result,
            'payload' => $data,
            'response' => $response,
            'subject' => $group,
        ]);

        return $response;
    }

    // ------------------------------------------------------------------
    // Pure helpers (no DB) — unit-testable
    // ------------------------------------------------------------------

    public static function key(int|string $subModuleId, int|string $actionId): string
    {
        return (int) $subModuleId.'|'.(int) $actionId;
    }

    /**
     * @param  array<string, int>  $existing  key => row id
     * @param  list<string>  $incomingKeys
     * @return array{create: list<string>, delete: list<int>}
     */
    public static function diff(array $existing, array $incomingKeys): array
    {
        $incoming = array_flip($incomingKeys);

        return [
            'create' => array_map('strval', array_keys(array_diff_key($incoming, $existing))),
            'delete' => array_values(array_diff_key($existing, $incoming)),
        ];
    }

    /**
     * @param  iterable<object{module_id:int, module_name:string, sub_module_id:int, sub_module_name:string, action_id:int, action_name:string, description:string}>  $rows  ordered catalogue rows
     * @param  array<string, true>  $assigned
     */
    public static function buildTree(iterable $rows, array $assigned): array
    {
        $modules = [];

        foreach ($rows as $row) {
            $row = (object) $row;

            $modules[$row->module_id] ??= [
                'module_id' => (int) $row->module_id,
                'module_name' => $row->module_name,
                'sub_modules' => [],
            ];

            $modules[$row->module_id]['sub_modules'][$row->sub_module_id] ??= [
                'sub_module_id' => (int) $row->sub_module_id,
                'sub_module_name' => $row->sub_module_name,
                'actions' => [],
            ];

            $modules[$row->module_id]['sub_modules'][$row->sub_module_id]['actions'][] = [
                'action_id' => (int) $row->action_id,
                'action_name' => $row->action_name,
                'description' => $row->description,
                'is_assigned' => isset($assigned[self::key($row->sub_module_id, $row->action_id)]),
            ];
        }

        return array_values(array_map(function (array $module) {
            $module['sub_modules'] = array_values($module['sub_modules']);

            return $module;
        }, $modules));
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /** All available sub-module actions, ordered like the sidebar. */
    private function catalogue()
    {
        return SystemSubModuleAction::query()
            ->join('system_sub_modules as ssm', 'ssm.id', '=', 'system_sub_modules_actions.system_sub_module_id')
            ->join('system_modules as sm', 'sm.id', '=', 'ssm.system_module_id')
            ->join('module_actions as ma', 'ma.id', '=', 'system_sub_modules_actions.module_action_id')
            ->orderBy('sm.module_order')
            ->orderBy('ssm.module_order')
            ->orderBy('system_sub_modules_actions.id')
            ->get([
                'sm.id as module_id',
                'sm.name as module_name',
                'ssm.id as sub_module_id',
                'ssm.name as sub_module_name',
                'ma.id as action_id',
                'ma.name as action_name',
                'system_sub_modules_actions.description',
            ]);
    }

    /**
     * A pair must exist in system_sub_modules_actions,
     * so a group cannot be granted an action the sub-module doesn't offer.
     */
    private function guardAgainstCatalogue(array $keys): void
    {
        if ($keys === []) {
            return;
        }

        $valid = SystemSubModuleAction::query()
            ->get(['system_sub_module_id', 'module_action_id'])
            ->mapWithKeys(fn ($r) => [self::key($r->system_sub_module_id, $r->module_action_id) => true])
            ->all();

        $invalid = array_values(array_diff($keys, array_keys($valid)));

        if ($invalid !== []) {
            throw new InvalidException(
                'These sub-module/action pairs are not available: ' . implode(', ', $invalid)
                . ' (format: system_sub_module|module_action).'
            );
        }
    }
}
```

:::

::: details Controller and routes
**`app/Http/Controllers/API/v1/modules/UserGroupController.php`**

```php
<?php

namespace App\Http\Controllers\API\v1\modules;

use App\Exceptions\InvalidException;
use App\Http\Controllers\Controller;
use App\Http\Requests\UserGroupMemberRequest;
use App\Http\Requests\UserGroupPermissionRequest;
use App\Http\Requests\UserGroupRequest;
use App\Http\Resources\GlobalResponseResource;
use App\Http\Resources\v1\modules\userGroup\UserGroupListResource;
use App\Http\Resources\v1\modules\userGroup\UserGroupMemberResource;
use App\Http\Resources\v1\modules\userGroup\UserGroupResource;
use App\Services\v1\modules\UserGroupMemberService;
use App\Services\v1\modules\UserGroupPermissionService;
use App\Services\v1\modules\UserGroupService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;

/**
 * User groups: CRUD, members and the permission tree.
 */
class UserGroupController extends Controller
{
    /**
     * Retrieve all user groups.
     *
     * Paginated list of user groups with their member, module and action counts.
     *
     * Query params:
     * - per_page: items per page (default 10)
     * - page: page number (default 1)
     * - search: keyword to search by group name
     * - name: filter by exact group name
     * - so: sort as "key,direction". Keys: "i" (id), "n" (name). Ordered by id by default.
     *
     * Example: /v1/user-groups?per_page=10&page=1&search=registrar&so=n,asc
     *
     * @authenticated
     */
    public function viewUserGroups(Request $request, UserGroupService $service) {
        try{
            $request->merge([
                'per_page' => $request->input('per_page', 10),
                'page' => $request->input('page', 1),
                'search' => $request->input('search', ''),
                'so' => $request->input('so', ''),
            ]);

            $userGroups = $service->viewUserGroupsService($request);

            return UserGroupListResource::collection($userGroups)->additional([
                'success' => true,
                'message' => 'User groups fetched successfully',
            ]);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Retrieve user groups (excluding Super Admin).
     *
     * Same as the user group list, but hides the protected Super Admin group (ID 1).
     *
     * Query params:
     * - per_page: items per page (default 10)
     * - page: page number (default 1)
     * - search: keyword to search by group name
     * - name: filter by exact group name
     * - so: sort as "key,direction". Keys: "i" (id), "n" (name). Ordered by id by default.
     *
     * @authenticated
     */
    public function viewFilteredUserGroups(Request $request, UserGroupService $service) {
        try{
            $request->merge([
                'per_page' => $request->input('per_page', 10),
                'page' => $request->input('page', 1),
                'search' => $request->input('search', ''),
                'so' => $request->input('so', ''),
            ]);

            $userGroups = $service->viewFilteredUserGroupsService($request);

            return UserGroupListResource::collection($userGroups)->additional([
                'success' => true,
                'message' => 'User groups fetched successfully',
            ]);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Get user group summary cards.
     *
     * Returns the total number of user groups, assigned personnel and unassigned personnel.
     *
     * @authenticated
     */
    public function userGroupStats(UserGroupService $service) {
        try{
            $response = $service->userGroupStatsService();

            return response()->json($response, 200);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Get a user group.
     *
     * Returns the name and description of a single user group.
     *
     * @authenticated
     */
    public function getUserGroup($id, UserGroupService $service) {
        try{
            $response = $service->getUserGroupService($id);

            return response()->json([
                'success' => $response->success,
                'message' => $response->message,
                'data' => UserGroupResource::make($response->data),
            ], 200);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Create a user group.
     *
     * Registers a new user group. Permissions and members are assigned separately.
     *
     * @authenticated
     */
    public function createUserGroup(UserGroupRequest $request, UserGroupService $service) {
        try{
            $response = $service->createUserGroupService($request->validated());

            return new GlobalResponseResource($response);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Update a user group.
     *
     * Modifies the name and/or description of an existing user group.
     *
     * @authenticated
     */
    public function updateUserGroup(UserGroupRequest $request, $id, UserGroupService $service) {
        try{
            $validatedRequest = array_merge($request->validated(), ['id' => $id]);

            $response = $service->updateUserGroupService($validatedRequest);

            return new GlobalResponseResource($response);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Delete a user group.
     *
     * Soft deletes a user group. Fails while the group still has members
     * or is the default group of a user role.
     *
     * @authenticated
     */
    public function deleteUserGroup($id, UserGroupService $service) {
        try{
            $response = $service->deleteUserGroupService($id);

            return new GlobalResponseResource($response);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Retrieve users for group assignment.
     *
     * Lists every user with their assignment status for this group: members first,
     * then unassigned users, then users who already belong to another group.
     *
     * Query params:
     * - per_page: items per page (default 10)
     * - page: page number (default 1)
     * - search: keyword to search by email, first name or last name
     *
     * @authenticated
     */
    public function viewUserGroupMembers(Request $request, $id, UserGroupMemberService $service) {
        try{
            $request->merge([
                'per_page' => $request->input('per_page', 10),
                'page' => $request->input('page', 1),
                'search' => $request->input('search', ''),
            ]);

            $users = $service->viewUserGroupMembersService($request, $id);

            return UserGroupMemberResource::collection($users)->additional([
                'success' => true,
                'message' => 'User group members fetched successfully',
            ]);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Update user group members.
     *
     * Replaces the group's member list with the given user IDs. A user can only
     * belong to one group, and the admin account cannot be removed from group 1.
     *
     * @authenticated
     */
    public function syncUserGroupMembers(UserGroupMemberRequest $request, $id, UserGroupMemberService $service) {
        try{
            $validatedRequest = array_merge($request->validated(), ['id' => $id]);

            $response = $service->syncUserGroupMembersService($validatedRequest);

            return new GlobalResponseResource($response);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Get user group permissions.
     *
     * Returns every module, sub-module and action, each action flagged with
     * is_assigned for this group.
     *
     * @authenticated
     */
    public function getUserGroupPermissions($id, UserGroupPermissionService $service) {
        try{
            $response = $service->getUserGroupPermissionsService($id);

            return response()->json($response, 200);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Update user group permissions.
     *
     * Send the full list of granted {system_sub_module, module_action} pairs.
     * Only the differences are written.
     *
     * @authenticated
     */
    public function syncUserGroupPermissions(UserGroupPermissionRequest $request, $id, UserGroupPermissionService $service) {
        try{
            $validatedRequest = array_merge($request->validated(), ['id' => $id]);

            $response = $service->syncUserGroupPermissionsService($validatedRequest);

            return new GlobalResponseResource($response);

        }catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User group not found.',
            ], 404);

        }catch (InvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);

        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }
}
```

**`routes/v1/modules/userGroup.php`**

```php
<?php

use App\Constants\ModuleActions;
use App\Constants\SubModules;
use App\Http\Controllers\API\v1\modules\UserGroupController;
use App\Http\Middleware\ModulePermissionMiddleware as Permission;
use Illuminate\Support\Facades\Route;
// Every route: auth:api, then the module permission check (Administrators bypass it).

$can = fn (string $subModule, string $action) => ['auth:api', Permission::using($subModule, $action)];

Route::prefix('v1/user-groups')->controller(UserGroupController::class)->group(function () use ($can) {

    // User Group Management
    Route::get('/', 'viewUserGroups')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::VIEW));
    Route::get('/filtered-list', 'viewFilteredUserGroups')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::VIEW));
    Route::get('/stats', 'userGroupStats')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::VIEW));
    Route::post('/', 'createUserGroup')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::CREATE));
    Route::get('/{id}', 'getUserGroup')->whereNumber('id')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::VIEW));
    Route::patch('/{id}', 'updateUserGroup')->whereNumber('id')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::UPDATE));
    Route::delete('/{id}', 'deleteUserGroup')->whereNumber('id')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::DELETE));

    // User Group Management: members
    Route::get('/{id}/members', 'viewUserGroupMembers')->whereNumber('id')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::VIEW));
    Route::put('/{id}/members', 'syncUserGroupMembers')->whereNumber('id')->middleware($can(SubModules::USER_GROUP_MANAGEMENT, ModuleActions::UPDATE));

    // Access Rights: permission tree
    Route::get('/{id}/permissions', 'getUserGroupPermissions')->whereNumber('id')->middleware($can(SubModules::ACCESS_RIGHTS, ModuleActions::VIEW));
    Route::put('/{id}/permissions', 'syncUserGroupPermissions')->whereNumber('id')->middleware($can(SubModules::ACCESS_RIGHTS, ModuleActions::UPDATE));
});
```

:::

| Endpoint | Permission |
|---|---|
| `GET/POST /api/v1/user-groups`, `GET/PATCH/DELETE /api/v1/user-groups/{id}` | User Group Management · View/Create/Update/Delete |
| `GET /api/v1/user-groups/stats`, `/filtered-list` | User Group Management · View |
| `GET/PUT /api/v1/user-groups/{id}/members` | User Group Management · View/Update |
| `GET/PUT /api/v1/user-groups/{id}/permissions` | Access Rights · View/Update |

## Check it works

```bash
php artisan migrate
php artisan db:seed --class=RbacSeeder
```

1. Log in as the admin; `data.user.permissions` lists everything and `is_superuser` is `true`.
2. As admin, `GET /api/v1/user-groups` returns the seeded groups.
3. Create a Staff user in tinker and put them in the **HR** group:

   ```bash
   php artisan tinker
   > $u = App\Models\User::factory()->create(['email' => 'hr@email.com'])
   > App\Models\UserGroup::where('name', 'HR')->first()->users()->attach($u->id)
   ```

4. Log in as `hr@email.com` / `password`: `GET /api/v1/user-groups` returns **403**, because HR has no User Group Management permission.

Next: [11 · API docs](/foundations/11-api-docs)
