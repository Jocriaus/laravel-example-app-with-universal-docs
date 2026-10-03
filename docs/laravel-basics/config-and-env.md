# Config & environment

Two layers:

1. **`.env`**: values that change per machine or environment (passwords, URLs, keys). Not committed.
2. **`config/*.php`**: PHP arrays that read `.env` and give each value a default. Committed.

```php
// config/auth.php
'jwt_ttl' => (int) env('JWT_TTL', 15),
```

```php
// anywhere in the app
config('auth.jwt_ttl');            // 15
config('auth.refresh_cookie.name', 'refresh_token');   // with a fallback
```

::: warning Only call `env()` inside `config/` files
In production you run `php artisan config:cache`, which bakes all config into one file and **stops reading `.env`**. After that, `env('X')` anywhere else returns `null`. Always go through `config()`.
:::

## Adding your own setting

1. Add the key to `.env` **and** `.env.example`.
2. Read it in a config file (an existing one, or a new `config/school.php` returning an array).
3. Use `config('school.some_key')` in code.

## Useful commands

```bash
php artisan config:show auth       # print the resolved auth config
php artisan config:cache           # production
php artisan config:clear           # after editing .env locally
php artisan about                  # overview of environment and drivers
```

## Environment checks in code

```php
app()->environment('local');         // true on your machine
app()->isProduction();
config('app.debug');
```

Next: [Seeding](/laravel-basics/seeding)
