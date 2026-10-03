# Middleware

Middleware wraps a request: it runs **before** the controller (to allow, deny or modify the request) and can run **after** (to change the response).

```
request ─► [ throttle ] ─► [ auth:api ] ─► [ module.permission ] ─► controller
response ◄──────────────────────────────────────────────────────────────┘
```

## Writing one

```bash
php artisan make:middleware EnsureUserIsActive
```

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && !$request->user()->is_active) {
            return response()->json(['success' => false, 'message' => 'Account disabled.'], 403);
        }

        return $next($request);          // continue to the next layer

        // To change the response instead:
        // $response = $next($request);
        // $response->headers->set('X-Something', '1');
        // return $response;
    }
}
```

## Registering

In `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    // a short name to use in routes
    $middleware->alias([
        'active' => \App\Http\Middleware\EnsureUserIsActive::class,
    ]);

    // run on every API request
    $middleware->api(append: [\App\Http\Middleware\ErrorLogMiddleware::class]);
})
```

## Using

```php
Route::get('/profile', ...)->middleware(['auth:api', 'active']);
Route::middleware('auth:api')->group(function () { ... });
Route::get('/admin', ...)->middleware(\App\Http\Middleware\EnsureUserIsActive::class);  // class directly
```

## Parameters

Anything after `:` is passed to `handle()`, split on commas:

```php
Route::post('/', 'store')->middleware('module.permission:Campus Setup,Create');

public function handle(Request $request, Closure $next, string $subModule, string $action): Response
```

## Built-in middleware you'll use

| Alias | Does |
|---|---|
| `auth:api` | require a logged-in user on the `api` guard (401 otherwise) |
| `throttle:10,1` | at most 10 requests per minute per user/IP (429 otherwise) |
| `signed` | require a valid signed URL |

Next: [Service container](/laravel-basics/service-container)
