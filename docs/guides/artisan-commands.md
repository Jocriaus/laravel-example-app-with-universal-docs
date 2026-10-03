# Artisan commands

## Generators used for a module

| Command | Creates |
|---|---|
| `php artisan make:migration create_campuses_table` | `database/migrations/..._create_campuses_table.php` |
| `php artisan make:model Campus` | `app/Models/Campus.php` |
| `php artisan make:request CampusRequest` | `app/Http/Requests/CampusRequest.php` |
| `php artisan make:service v1/modules/CampusService` | `app/Services/v1/modules/CampusService.php` |
| `php artisan make:resource v1/modules/campus/CampusResource` | `app/Http/Resources/v1/modules/campus/CampusResource.php` |
| `php artisan make:controller API/v1/modules/CampusController` | `app/Http/Controllers/API/v1/modules/CampusController.php` |
| `php artisan make:controller Web/CampusPageController` | `app/Http/Controllers/Web/CampusPageController.php` (Blade pages) |
| `php artisan make:test CampusTest --pest` | `tests/Feature/CampusTest.php` |

## `make:service`

A custom generator (`app/Console/Commands/MakeServiceCommand.php`) that renders `stubs/service.stub` into `app/Services`. Include the subfolder in the name:

```bash
php artisan make:service v1/modules/CampusService   # App\Services\v1\modules\CampusService
php artisan make:service v1/global/ReportService    # App\Services\v1\global\ReportService
```

Edit `stubs/service.stub` to change what every new service starts with.

## Project commands

| Command | Does |
|---|---|
| `php artisan auth:purge-refresh-sessions --days=7` | Deletes refresh-session rows that expired more than 7 days ago. Schedule it daily |
| `php artisan db:seed --class=RbacSeeder` | Re-seeds modules, actions, groups and permissions (additive) |

## Everyday commands

| Command | Use |
|---|---|
| `php artisan route:list --path=v1/campuses` | Check URLs and middleware of a module |
| `php artisan migrate:fresh --seed` | Rebuild the local database from scratch |
| `php artisan scramble:export` | Write the OpenAPI spec to `api.json` |
| `php artisan test` / `./vendor/bin/pest` | Run the tests |
| `php artisan optimize:clear` | Clear config, route and view caches after changing `.env` |
