# Tour of a fresh app

```
school-api/
├── app/                  your PHP code
│   ├── Http/Controllers/ controllers (Controller.php is the base class)
│   ├── Models/           Eloquent models (User.php)
│   └── Providers/        service providers (AppServiceProvider.php)
├── bootstrap/
│   ├── app.php           ★ routing, middleware and exception setup
│   └── providers.php     list of service providers to load
├── config/               configuration files (read .env through env())
├── database/
│   ├── factories/        fake data for tests
│   ├── migrations/       schema changes, run in filename order
│   └── seeders/          initial data (DatabaseSeeder.php)
├── public/               web root: index.php is the single entry point
├── resources/
│   ├── views/            Blade templates
│   ├── css/, js/         frontend assets built by Vite
├── routes/
│   ├── web.php           browser routes (sessions, CSRF)
│   ├── api.php           /api routes (after install:api)
│   └── console.php       Artisan commands and the schedule
├── storage/              logs, uploaded files, cache (must be writable)
├── tests/                Pest tests (Feature/ and Unit/)
├── vendor/               Composer packages (never edit, never commit)
├── .env                  local settings (never commit)
├── artisan               the command-line tool
├── composer.json         PHP dependencies
└── package.json          JS dependencies (Vite, Tailwind)
```

## `bootstrap/app.php`

Modern Laravel has no `Kernel.php`. Routing, middleware and exception handling are configured in one place:

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // middleware aliases and groups go here
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // exception reporting / rendering goes here
    })->create();
```

You will come back to this file often in [Foundations](/foundations/).

## Web routes vs API routes

| | `routes/web.php` | `routes/api.php` |
|---|---|---|
| URL prefix | none | `/api` |
| Middleware group | `web`: cookies, sessions, CSRF | `api`: stateless |
| Use for | Blade pages | JSON endpoints |

## Artisan

`php artisan` lists every command. The ones you'll use most:

```bash
php artisan serve                    # dev server
php artisan make:model Campus -m     # model + migration
php artisan make:controller CampusController
php artisan route:list
php artisan migrate
php artisan tinker                   # interactive PHP shell with your app loaded
php artisan optimize:clear           # clear cached config/routes/views
```

## Check it works

```bash
php artisan about
```

prints your Laravel version, PHP version, environment, debug mode and drivers. Confirm **Environment: local** and **Database: mysql**.

Next: [Routing](/laravel-basics/routing)
