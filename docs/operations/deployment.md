# Deployment checklist

Moving from your computer to a server. Work through it top to bottom the first time; afterwards the **Every release** section is enough.

## The server

| Need | Notes |
|---|---|
| PHP 8.3+ with PHP-FPM | same extensions as locally, plus `opcache` |
| Nginx or Apache | document root = the project's **`public/`** folder, never the project root |
| MySQL 8 | a dedicated database user with rights on one database only |
| Composer, Git | to install and update |
| HTTPS certificate | Let's Encrypt (certbot) or your organisation's certificate |
| cron | for the scheduler |

## First deployment

```bash
git clone <repo> /var/www/school-api && cd /var/www/school-api
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

### `.env` for production

```ini
APP_ENV=production
APP_DEBUG=false                     # never true in production
APP_URL=https://api.school.edu
APP_TIMEZONE=UTC

DB_HOST=...
DB_DATABASE=...
DB_USERNAME=...                     # not root
DB_PASSWORD=...                     # strong, unique

JWT_PRIVATE_KEY_PATH=storage/keys/private.key
JWT_PUBLIC_KEY_PATH=storage/keys/public.key
REFRESH_TOKEN_PEPPER=...            # new value, not the local one
REFRESH_COOKIE_SECURE=true
AUTH_TRUSTED_ORIGINS=https://app.school.edu
CORS_ALLOWED_ORIGINS=https://app.school.edu

MAIL_MAILER=smtp                    # plus MAIL_HOST, MAIL_USERNAME, ...
LOG_LEVEL=warning
```

### Keys and permissions

```bash
mkdir -p storage/keys
openssl genrsa -out storage/keys/private.key 4096
openssl rsa -in storage/keys/private.key -pubout -out storage/keys/public.key
chmod 600 storage/keys/private.key

# the web server user must be able to write these
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache
```

Generate **new** keys and a **new** pepper per environment. Back them up somewhere safe: losing the pepper logs everyone out; losing the private key invalidates every access token.

### Database

```bash
php artisan migrate --force
php artisan db:seed --force          # roles, first admin, permissions (safe to re-run)
```

Log in right away and **change the seeded admin password**.

### Nginx (essentials)

```nginx
server {
    listen 443 ssl http2;
    server_name api.school.edu;
    root /var/www/school-api/public;

    index index.php;
    client_max_body_size 10M;               # match your upload limits

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    location ~ /\.(?!well-known) { deny all; }   # hide .env, .git, ...
}
```

### Scheduler

```bash
# crontab -e (as the web server user)
* * * * * cd /var/www/school-api && php artisan schedule:run >> /dev/null 2>&1
```

This runs `auth:purge-refresh-sessions` daily, and any other scheduled task.

### Queue (only if you queue jobs or mail)

Run `php artisan queue:work` under a process manager such as Supervisor so it restarts automatically.

## Every release

```bash
php artisan down                         # maintenance mode (503)
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize                     # caches config, routes, views, events
php artisan queue:restart                # if you use queues
php artisan up
```

::: warning After `config:cache`
Laravel no longer reads `.env`. Change `.env`, then run `php artisan optimize` again. This is also why `env()` must only be called in `config/` files.
:::

## Before you announce it

- [ ] `APP_DEBUG=false`, and `https://api.school.edu/.env` returns 404
- [ ] HTTPS only; the refresh cookie has `Secure`
- [ ] Login works from the real frontend origin (CORS + trusted origins)
- [ ] `/docs/api` is hidden or protected as you decided
- [ ] The admin password has been changed
- [ ] Backups: database daily, plus `storage/app/private` (uploads) and `storage/keys`
- [ ] `composer audit` shows no known vulnerabilities
- [ ] The log at `storage/logs/laravel.log` is rotated (`LOG_CHANNEL=daily`)
