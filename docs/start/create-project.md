# Create the project

## 1. Create a new Laravel app

```bash
laravel new school-api
```

The installer asks a few questions. For an API backend:

| Question | Answer | Why |
|---|---|---|
| Starter kit | **None** | we build an API; starter kits add session-based web auth and a frontend |
| Testing framework | **Pest** | used in these docs |
| Database | **MySQL** | the default is SQLite; we use MySQL |
| Run migrations? | **No** (for now) | configure `.env` first |

::: details Without the Laravel installer
```bash
composer create-project laravel/laravel school-api
cd school-api
composer require pestphp/pest --dev --with-all-dependencies
./vendor/bin/pest --init
```
:::

```bash
cd school-api
git init && git add . && git commit -m "Fresh Laravel app"
```

## 2. Enable API routes

A fresh Laravel app only has web routes. Add the API layer:

```bash
php artisan install:api
```

This command:

- creates `routes/api.php` and registers it in `bootstrap/app.php` with the `/api` prefix,
- installs **Laravel Sanctum** and publishes its `personal_access_tokens` migration.

We build our own JWT authentication in [Foundations](/foundations/), so Sanctum's tokens are not used. It is harmless to keep. To remove it: `composer remove laravel/sanctum`, then delete the `personal_access_tokens` migration and the `HasApiTokens` trait from `User`.

## 3. Run it

```bash
php artisan serve        # http://127.0.0.1:8000
```

With Herd, the project is also served at `http://school-api.test` automatically if it lives in the Herd folder.

`composer run dev` starts the server, the queue worker, the log viewer and Vite together; use it once you work on Blade pages.

## Check it works

Open `http://127.0.0.1:8000`. You should see the Laravel welcome page.

```bash
php artisan route:list
```

shows the routes registered so far (including `api/user` from `install:api`).

Next: [Configure the environment](/start/configure-environment)
