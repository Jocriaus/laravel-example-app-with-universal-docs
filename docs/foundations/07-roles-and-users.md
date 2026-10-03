# 07 · Roles & users

**Why:** before login we need accounts. Every user has a **role** (Admin, Staff) for coarse access, first and last name, an active flag, and soft deletes so accounts are deactivated instead of erased.

## Migrations

Never edit a migration that has already run on a shared database; add new ones. The default `users` table has a single `name` column, so we replace it.

```bash
php artisan make:migration create_user_roles_table
php artisan make:migration update_users_table_for_roles
```

**`database/migrations/2026_10_01_000001_create_user_roles_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
```

**`database/migrations/2026_10_01_000002_update_users_table_for_roles.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The default users table has a single "name" column. We need first/last name,
 * a role, an active flag and soft deletes. Never edit a migration that already
 * ran on a shared database: add a new one like this instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('name');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('user_role_id')->after('id')->constrained('user_roles');
            $table->string('first_name', 100)->nullable()->after('user_role_id');
            $table->string('last_name', 100)->nullable()->after('first_name');
            $table->boolean('is_active')->default(true)->after('password');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_role_id');
            $table->dropColumn(['first_name', 'last_name', 'is_active', 'deleted_at']);
            $table->string('name')->after('id');
        });
    }
};
```

The `create_user_roles_table` migration must be **older** (smaller timestamp) than `update_users_table_for_roles`, because users now point at roles.

## Role ids as constants

**`app/Constants/UserRoles.php`**

```php
<?php

namespace App\Constants;

/**
 * user_roles.id values seeded by UserRoleSeeder.
 * Use with the "role" middleware: 'role:' . UserRoles::roles(UserRoles::ADMINISTRATOR, UserRoles::STAFF)
 */
class UserRoles
{
    public const ADMINISTRATOR = 1;
    public const STAFF = 2;

    /** Joins role ids with "|" for the role middleware parameter. */
    public static function roles(int ...$roles): string
    {
        return implode('|', $roles);
    }
}
```


## Models

**`app/Models/UserRole.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class UserRole extends Model
{
    use SoftDeletes;

    protected $fillable = ['name'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
```

**`app/Models/User.php`** (steps 10 and 12 add to it)

```php
<?php

namespace App\Models;

use App\Traits\Filterable;
use App\Traits\Searchable;
use App\Traits\Sortable;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes, Filterable, Searchable, Sortable;

    protected $fillable = [
        'user_role_id',
        'first_name',
        'last_name',
        'email',
        'password',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function userRole(): BelongsTo
    {
        return $this->belongsTo(UserRole::class, 'user_role_id');
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function getQueryConfig()
    {
        return (object) [
            'searchable' => ['email', 'first_name', 'last_name'],
            'filterable' => ['uri' => 'user_role_id', 'active' => 'is_active'],
            'sortAliases' => ['e' => 'email', 'l' => 'last_name'],
        ];
    }

    public function implementSort(Builder $query, string $column, $direction)
    {
        if (!in_array($column, ['email', 'last_name'], true)) {
            return $query;
        }

        return $query->orderBy($column, strtolower($direction) === 'desc' ? 'desc' : 'asc');
    }
}
```

The factory must match the new columns:

**`database/factories/UserFactory.php`**

```php
<?php

namespace Database\Factories;

use App\Constants\UserRoles;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'user_role_id' => UserRoles::STAFF,
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'is_active' => true,
            'remember_token' => Str::random(10),
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
```


## Role middleware

**`app/Http/Middleware/CheckRoleMiddleware.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Coarse, role-based check:  ->middleware(['auth:api', 'role:' . UserRoles::roles(UserRoles::ADMINISTRATOR)])
 * The parameter is a "|"-separated list of user_roles.id values.
 */
class CheckRoleMiddleware
{
    public function handle(Request $request, Closure $next, string $userRoleIds): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $allowedRoles = array_map('intval', explode('|', $userRoleIds));

        if (!in_array((int) $user->user_role_id, $allowedRoles, true)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized user role.'], 403);
        }

        if ($user->trashed() || !$user->is_active) {
            return response()->json(['success' => false, 'message' => 'User disabled.'], 403);
        }

        return $next($request);
    }
}
```

Register the alias in `bootstrap/app.php`:

```php
$middleware->alias([
    'role' => \App\Http\Middleware\CheckRoleMiddleware::class,
]);
```

Use it on platform-level routes (user management, the activity log):

```php
->middleware(['auth:api', 'role:' . UserRoles::roles(UserRoles::ADMINISTRATOR, UserRoles::STAFF)])
```

## Seeders

**`database/seeders/UserRoleSeeder.php`**

```php
<?php

namespace Database\Seeders;

use App\Models\UserRole;
use Illuminate\Database\Seeder;

/** Ids must match App\Constants\UserRoles: Admin = 1, Staff = 2. */
class UserRoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([1 => 'Admin', 2 => 'Staff'] as $id => $name) {
            UserRole::updateOrCreate(['id' => $id], ['name' => $name]);
        }
    }
}
```

**`database/seeders/UserSeeder.php`**

```php
<?php

namespace Database\Seeders;

use App\Constants\UserRoles;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The first administrator. Change this password right after the first login
 * on any shared environment.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@email.com'],
            [
                'user_role_id' => UserRoles::ADMINISTRATOR,
                'first_name' => 'System',
                'last_name' => 'Administrator',
                'password' => 'admin', // hashed by the "hashed" cast on User
                'is_active' => true,
            ]
        );
    }
}
```

**`database/seeders/DatabaseSeeder.php`** (step 10 adds RbacSeeder)

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
        ]);
    }
}
```


## Check it works

```bash
php artisan migrate:fresh --seed
php artisan tinker
> App\Models\User::first()->only(['email', 'user_role_id', 'is_active'])
= ["email" => "admin@email.com", "user_role_id" => 1, "is_active" => true]
```

Next: [08 · JWT access tokens](/foundations/08-jwt-access-tokens)
