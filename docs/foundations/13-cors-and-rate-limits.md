# 13 · CORS & rate limits

## CORS

**Why:** browsers block JavaScript on one **origin** (scheme + host + port, e.g. `http://localhost:5173`) from reading responses from another (`http://127.0.0.1:8000`) unless the server allows it. That is **CORS** (Cross-Origin Resource Sharing). Tools like curl and Postman ignore it; only browsers enforce it.

Publish the config:

```bash
php artisan config:publish cors
```

Set `config/cors.php`:

```php
return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter(explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => true,   // the refresh cookie must travel
];
```

```ini
# .env
CORS_ALLOWED_ORIGINS=http://localhost:5173
AUTH_TRUSTED_ORIGINS=http://localhost:5173
```

| Setting | Why |
|---|---|
| exact `allowed_origins` | with credentials, browsers refuse `*` |
| `supports_credentials: true` | cookies (the refresh token) are sent and accepted |
| same list in `AUTH_TRUSTED_ORIGINS` | the origin check on login/refresh/logout (step 09) |

The frontend must opt in to cookies on auth calls:

```js
fetch('http://127.0.0.1:8000/api/v1/auth/token/refresh', { method: 'POST', credentials: 'include' })
// axios: withCredentials: true
```

::: tip Same domain = no CORS
Serving the SPA and the API from one domain (`app.school.edu` and `app.school.edu/api`) avoids CORS and lets the refresh cookie stay `SameSite=Strict`. With different domains, cookies may need `SameSite=None; Secure` and a shared parent domain.
:::

## Rate limits

**Why:** stop password guessing and runaway scripts.

The `throttle:<max>,<minutes>` middleware counts requests per user (or per IP for guests):

```php
Route::post('/login', 'login')->middleware('throttle:10,1');          // 10 per minute
Route::post('/token/refresh', 'refreshToken')->middleware('throttle:60,1');
```

Over the limit the client gets **429 Too Many Requests** with a `Retry-After` header.

For reusable, smarter limits, define **named limiters** in `AppServiceProvider::boot()`:

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('login', function (Request $request) {
    return [
        Limit::perMinute(10)->by($request->ip()),                                   // per IP
        Limit::perMinute(5)->by(strtolower((string) $request->input('email'))),     // per account
    ];
});

RateLimiter::for('api', fn (Request $request) =>
    Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));
```

```php
Route::post('/login', 'login')->middleware('throttle:login');
```

Limits are counted in the **cache**. With several servers, use a shared cache (database or Redis), otherwise each server counts separately.

## Behind a proxy

In production behind Nginx, a load balancer or Cloudflare, Laravel sees the proxy's IP unless you trust it. Rate limits and logs then treat everyone as one client. In `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->trustProxies(at: ['10.0.0.0/8']);   // your proxy's addresses; '*' only if nothing else can reach the app
})
```

## Check it works

1. Run the frontend on `http://localhost:5173` and call `/api/v1/health` with `fetch`: no CORS error in the console.
2. Send 11 wrong logins within a minute: the 11th returns **429**.

You now have the complete foundation. Next: [Creating a module](/guides/creating-a-module).
