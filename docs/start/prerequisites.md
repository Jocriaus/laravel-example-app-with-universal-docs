# Prerequisites

Install these once per computer.

| Tool | Version | Why |
|---|---|---|
| PHP | **8.3 or newer** (Laravel 13 requirement) | runs Laravel |
| PHP extensions | `openssl`, `pdo_mysql`, `mbstring`, `fileinfo`, `curl`, `zip` | used by Laravel and the packages we install |
| Composer | 2.x | PHP packages |
| MySQL | 8.x (or MariaDB 10.6+) | database |
| Node.js | current LTS | Vite (frontend assets), these docs |
| Git | any recent | version control |
| Editor | VS Code or PhpStorm | writing code |

## Option A (Windows / macOS): Laravel Herd

[Laravel Herd](https://herd.laravel.com/windows) is the official one-click environment. It installs PHP, Composer and the `laravel` installer, and serves every project in your Herd folder at `http://<folder>.test`.

1. Download and install Herd, then open it once.
2. In a **new** terminal:

   ```bash
   php -v          # PHP 8.3+
   composer -V
   laravel --version
   ```

3. **Database:** install MySQL (MySQL Community Server, or the MySQL bundled with XAMPP/Laragon), or use the database services in Herd Pro. Check which services your Herd edition includes on the Herd website.
4. **Node:** install the LTS from nodejs.org if `node -v` fails.

## Option B (Windows): Laragon or XAMPP

Both bundle PHP, MySQL and a web server.

- **Laragon:** make sure its PHP version is 8.3+ (Menu → PHP → Version). It includes Composer and Node.
- **XAMPP:** install Composer separately from getcomposer.org and point it at `C:\xampp\php\php.exe`. XAMPP's bundled PHP must be 8.3+.

Then install the Laravel installer:

```bash
composer global require laravel/installer
```

and make sure Composer's global `vendor/bin` folder is on your `PATH` (the Composer installer prints it).

## Option C (Linux / WSL)

```bash
# Ubuntu example: PHP from the ondrej/php PPA
sudo apt install php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip unzip
curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer
composer global require laravel/installer
sudo apt install mysql-server
```

## Enable the PHP extensions

Run `php -m` and check the list includes `openssl`, `pdo_mysql`, `mbstring`, `fileinfo`. If one is missing, open the `php.ini` shown by `php --ini` and remove the `;` in front of `extension=...`.

## Editor extensions (VS Code)

| Extension | Why |
|---|---|
| PHP Intelephense | autocompletion, go to definition |
| Laravel (official) | route, view and config autocompletion |
| REST Client | run `.http` request files |
| EditorConfig | consistent formatting |
| GitLens (optional) | who changed what |

## Check it works

```bash
php -v && composer -V && laravel --version && node -v && git --version && mysql --version
```

All six commands must print a version.

Next: [Create the project](/start/create-project)
