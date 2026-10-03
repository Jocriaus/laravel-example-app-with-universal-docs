# The web development workflow

The tools and habits you use every day, whatever the framework.

## Your toolbox

| Tool | What it's for | Recommended |
|---|---|---|
| Code editor | writing code | VS Code with the **PHP Intelephense**, **Laravel** and **Vue/Volar** extensions (or PhpStorm) |
| Terminal | running commands | Windows Terminal (PowerShell), or the terminal inside VS Code |
| Git | version history, teamwork | Git + GitHub / GitLab |
| PHP | runs the backend | PHP 8.3+ (installed by Herd or Laragon) |
| Composer | PHP package manager | installed with PHP |
| Node.js + npm | frontend build tools (Vite), these docs | current LTS |
| Database server + client | storing and inspecting data | MySQL 8 + HeidiSQL, TablePlus or DBeaver |
| HTTP client | calling your API by hand | VS Code **REST Client** extension (`.http` files), Postman, or Bruno |
| Browser DevTools | inspecting requests, cookies, console errors | F12 in Chrome / Edge / Firefox |

Installing them: [Prerequisites](/start/prerequisites).

## Package managers

You rarely write everything yourself; you install **packages**.

| | PHP | JavaScript |
|---|---|---|
| Tool | Composer | npm |
| List of packages | `composer.json` | `package.json` |
| Exact installed versions | `composer.lock` | `package-lock.json` |
| Installed files | `vendor/` | `node_modules/` |
| Add a package | `composer require vendor/package` | `npm install package` |
| Install everything after cloning | `composer install` | `npm install` |

- **Commit** `composer.json`, `composer.lock`, `package.json`, `package-lock.json`.
- **Never commit** `vendor/` or `node_modules/`: they are rebuilt from the lock files.

## Environments

The same code runs in several places with different settings:

| Environment | Who uses it | Typical settings |
|---|---|---|
| **local** | you, on your computer | `APP_DEBUG=true`, local database, fake mail |
| **staging** | testers, before release | like production, test data |
| **production** | real users | `APP_DEBUG=false`, HTTPS, real mail, backups |

Settings that change per environment live in the **`.env`** file, which is **never committed**. A `.env.example` with safe placeholder values is committed so teammates know what to fill in. See [Config & environment](/laravel-basics/config-and-env).

## Git basics

```bash
git clone <url>                 # get a copy of a repository
git switch -c feature/campus    # start a branch for your work
git status                      # what changed?
git add .                       # stage changes
git commit -m "Add campus module"
git push -u origin feature/campus
```

Then open a **pull request** so a teammate reviews the change before it is merged into `main`.

Good habits:

- One branch per feature or fix; small, focused commits.
- Commit messages say *what* and *why*: `Add campus module with permissions`, not `update`.
- Pull `main` often to avoid big conflicts.
- Never commit secrets (`.env`, private keys). If you do, **rotate them**: deleting the commit is not enough.

## The development loop

```
 write code ─► run it ─► check it (browser / .http / tests) ─► read errors ─► fix
      ▲                                                                         │
      └─────────────────────────────────────────────────────────────────────────┘
```

Where to look when something breaks:

| Symptom | Look at |
|---|---|
| API returns 500 | `storage/logs/laravel.log`, and the `message` field when `APP_DEBUG=true` |
| API returns 422 | the `message`: validation told you what's wrong |
| "Route not found" / 404 | `php artisan route:list` |
| Old config still used | `php artisan optimize:clear` |
| Frontend call fails | DevTools → Network (status, response) and Console (CORS errors) |
| Wrong data | your database client: look at the actual rows |

Debug helpers: `dd($value)` (dump and stop), `dump($value)`, `logger('message', ['context' => $x])`, and `php artisan tinker` to run PHP against your app interactively.

## Testing

Automated tests are code that checks your code. They let you change things without fear:

```bash
php artisan test
```

See [Testing with Pest](/laravel-basics/testing).

Next: [Databases & SQL](/fundamentals/databases-and-sql)
