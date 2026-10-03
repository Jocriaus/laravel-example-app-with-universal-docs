# 02 · Route auto-loading

**Why:** with one big `routes/api.php`, every module edits the same file and merge conflicts pile up. Give each module its own route file and load them all automatically.

## Replace `routes/api.php`

**`routes/api.php`**

```php
<?php

// ---------------------------------------------------------------------------
// Do not add routes here. Create one file per module in routes/v1/modules/;
// every file in that folder is loaded automatically.
// ---------------------------------------------------------------------------

foreach (glob(base_path('routes/v1/modules/*.php')) as $routeFile) {
    require $routeFile;
}
```

`install:api` already registered this file in `bootstrap/app.php` with the `/api` prefix, so a route file that declares `Route::prefix('v1/health')` answers at `/api/v1/health`.

## Add a first module file

**`routes/v1/modules/health.php`**

```php
<?php

use Illuminate\Support\Facades\Route;

Route::prefix('v1/health')->group(function () {
    Route::get('/', fn () => [
        'success' => true,
        'message' => 'API is running',
        'time' => now()->toIso8601String(),
    ]);
});
```

## Rules for route files

- One file per module, named after it (`campus.php`, `userGroup.php`).
- Each file sets its own `v1/...` prefix.
- Put fixed paths (`/stats`) before parameters (`/{id}`), and constrain ids with `->whereNumber('id')`.
- Every protected route gets `auth:api` and a permission (steps 08–10).

## Check it works

```bash
php artisan route:list --path=v1
curl -H "Accept: application/json" http://127.0.0.1:8000/api/v1/health
```

returns `{"success":true,"message":"API is running",...}`.

Next: [03 · Responses & errors](/foundations/03-responses-and-errors)
