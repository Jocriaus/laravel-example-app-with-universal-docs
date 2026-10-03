# Routing

A **route** connects a method + URL to code.

```php
// routes/api.php   (URL gets the /api prefix automatically)
use App\Http\Controllers\CampusController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn () => ['pong' => true]);                 // GET /api/ping

Route::get('/v1/campuses', [CampusController::class, 'index']);  // controller method
```

## Parameters

```php
Route::get('/v1/campuses/{id}', [CampusController::class, 'show'])
    ->whereNumber('id');     // only digits match, so /campuses/stats won't hit this route

Route::get('/v1/campuses/{id}/colleges/{collegeId?}', ...);   // ? = optional
```

The parameter arrives as a controller argument with the same name: `public function show($id)`.

### Route model binding

Type-hint a model and Laravel loads it (or returns 404):

```php
Route::get('/v1/campuses/{campus}', [CampusController::class, 'show']);

public function show(Campus $campus) { ... }   // Campus::findOrFail($campus)
```

These docs usually pass `$id` and call `findOrFail()` in the **service**, so the service controls how the record is loaded (with relations, including soft-deleted ones, etc.).

## Groups

Share a prefix, a controller and middleware:

```php
Route::prefix('v1/campuses')
    ->controller(CampusController::class)
    ->middleware('auth:api')
    ->group(function () {
        Route::get('/', 'index');           // GET    /api/v1/campuses
        Route::post('/', 'store');          // POST   /api/v1/campuses
        Route::get('/{id}', 'show')->whereNumber('id');
        Route::patch('/{id}', 'update')->whereNumber('id');
        Route::delete('/{id}', 'destroy')->whereNumber('id');
    });
```

## Order matters

Routes are matched top to bottom. Put fixed paths before parameters:

```php
Route::get('/stats', 'stats');           // first
Route::get('/{id}', 'show');             // then the catch-all
```

## Named routes

```php
Route::get('/campuses', ...)->name('campuses.index');

route('campuses.index');   // builds the URL, e.g. in Blade or redirects
```

## Inspecting routes

```bash
php artisan route:list
php artisan route:list --path=v1/campuses -v     # -v also shows middleware
```

## Check it works

Add the `/ping` route above to `routes/api.php`, then:

```bash
curl -H "Accept: application/json" http://127.0.0.1:8000/api/ping
# {"pong":true}
```

Next: [Controllers](/laravel-basics/controllers)
