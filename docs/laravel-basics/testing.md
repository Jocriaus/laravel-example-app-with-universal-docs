# Testing with Pest

Tests are small programs that call your app and check the result. Run them after every change.

```bash
php artisan test            # or ./vendor/bin/pest
php artisan test --filter=campus
```

## A feature test

Feature tests call your routes like a real client.

```bash
php artisan make:test CampusTest --pest
```

```php
<?php

use App\Models\Campus;
use App\Models\User;

beforeEach(function () {
    $this->seed();                                           // roles, admin, permissions
    $this->admin = User::where('email', 'admin@email.com')->first();
});

it('lists campuses', function () {
    Campus::factory()->count(3)->create();

    $this->actingAs($this->admin, 'api')
        ->getJson('/api/v1/campuses')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('success', true);
});

it('requires a name', function () {
    $this->actingAs($this->admin, 'api')
        ->postJson('/api/v1/campuses', ['code' => 'MAIN', 'is_active' => true])
        ->assertStatus(422)
        ->assertJsonPath('success', false);
});

it('rejects guests', function () {
    $this->getJson('/api/v1/campuses')->assertUnauthorized();
});
```

- `getJson` / `postJson` / `patchJson` / `deleteJson` send `Accept: application/json`.
- `actingAs($user, 'api')` logs the user in on the `api` guard without a real token (the guard must implement `setUser()`; ours does).
- `expect($value)->toBe(...)` for plain values.

## A fresh database for every test

Use a separate database so tests never touch your data. In `phpunit.xml`:

```xml
<env name="DB_CONNECTION" value="mysql"/>
<env name="DB_DATABASE" value="school_api_test"/>
```

and in `tests/Pest.php`:

```php
pest()->extend(Tests\TestCase::class)
    ->use(Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');
```

`RefreshDatabase` migrates once and wraps each test in a transaction that is rolled back.

## Unit tests

For plain classes with no database or HTTP:

```php
it('expands a module wildcard', function () {
    $modules = ['Setup' => ['Campus Setup' => ['View', 'Create']]];

    expect(PermissionMatrix::expand($modules, ['Setup' => '*']))->toHaveCount(2);
});
```

## What to test

For every module: the happy path, one validation failure, one permission failure (403), and every business rule ("can't delete a group with members").

Next: [Build the foundations](/foundations/)
