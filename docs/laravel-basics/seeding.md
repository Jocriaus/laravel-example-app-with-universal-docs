# Seeding

**Seeders** put initial data in the database: roles, the first admin account, permission lists, demo data.

```bash
php artisan make:seeder UserRoleSeeder
```

```php
<?php

namespace Database\Seeders;

use App\Models\UserRole;
use Illuminate\Database\Seeder;

class UserRoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Admin', 'Staff'] as $name) {
            UserRole::firstOrCreate(['name' => $name]);   // safe to run twice
        }
    }
}
```

`DatabaseSeeder` decides the order:

```php
public function run(): void
{
    $this->call([
        UserRoleSeeder::class,   // roles first: users reference them
        UserSeeder::class,
    ]);
}
```

```bash
php artisan db:seed                              # runs DatabaseSeeder
php artisan db:seed --class=UserRoleSeeder       # one seeder
php artisan migrate:fresh --seed                 # rebuild + seed (local only!)
```

## Idempotent seeders

Use `firstOrCreate` / `updateOrCreate` so seeding twice doesn't duplicate rows or crash on unique keys. Then seeders can also run in production to add new reference data.

## Factories: fake data for tests

```bash
php artisan make:factory CampusFactory
```

```php
public function definition(): array
{
    return [
        'code' => strtoupper($this->faker->unique()->lexify('???')),
        'name' => $this->faker->city() . ' Campus',
        'is_active' => true,
    ];
}
```

```php
Campus::factory()->count(20)->create();
```

The model needs `use HasFactory;` for this to work.

Next: [Transactions](/laravel-basics/transactions)
