# 11 · API docs (Scramble)

**Why:** frontend developers need to know every endpoint, parameter and response. Writing that by hand drifts from the code within a week. **Scramble** generates OpenAPI documentation from your routes, form requests, resources and docblocks.

## Install

```bash
composer require dedoc/scramble
php artisan vendor:publish --provider="Dedoc\Scramble\ScrambleServiceProvider" --tag="scramble-config"
```

Open `http://127.0.0.1:8000/docs/api`: every `/api` route is already listed.

## Declare the Bearer token and who may see the docs

**`app/Providers/ScrambleServiceProvider.php`**

```php
<?php

namespace App\Providers;

use App\Constants\UserRoles;
use App\Models\User;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class ScrambleServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Every endpoint is documented as "Bearer JWT"; @unauthenticated opts one out.
        Scramble::configure()
            ->withDocumentTransformers(function (OpenApi $openApi) {
                $openApi->secure(SecurityScheme::http('bearer', 'JWT'));
            });

        // /docs/api is open in "local". Elsewhere only this gate opens it.
        // The docs routes use the web guard: set this to fit how you protect them
        // (e.g. HTTP basic auth at the web server, or return false to hide them).
        Gate::define('viewApiDocs', function (?User $user = null) {
            return $user !== null && (int) $user->user_role_id === UserRoles::ADMINISTRATOR;
        });
    }
}
```

Add it to `bootstrap/providers.php`:

```php
return [
    App\Providers\AppServiceProvider::class,
    App\Providers\AuthServiceProvider::class,
    App\Providers\ScrambleServiceProvider::class,
];
```

In `config/scramble.php` you can set the title, the servers list (for "Try it"), and the theme:

```php
'ui' => [
    'title' => env('APP_NAME'),
    'theme' => 'system',
    'try_it_credentials_policy' => 'include',   // sends cookies with "Try it" (refresh endpoint)
],
'servers' => [
    'Local' => 'http://127.0.0.1:8000/api',
],
```

::: warning Production
The docs are open in the `local` environment only. Elsewhere, access goes through the `viewApiDocs` gate above. Decide deliberately whether production shows them.
:::

## Write code that documents itself

| Scramble reads | It becomes |
|---|---|
| Route method + URI | the endpoint |
| Controller docblock, first line | the title |
| Docblock paragraph (e.g. a `Query params:` list) | the description |
| `@authenticated` / `@unauthenticated` | lock icon / public |
| FormRequest `rules()` | the request body with types and required flags |
| `// @example value` above a rule | example values |
| Resource `toArray()` | the response schema |

```php
/**
 * Create a campus.
 *
 * Registers a new campus. The code must be unique among active campuses.
 *
 * @authenticated
 */
public function createCampus(CampusRequest $request, CampusService $service) { ... }
```

```php
return [
    // @example MAIN
    'code' => ['required', 'string', 'max:20'],
];
```

## Export the spec

```bash
php artisan scramble:export     # writes api.json
```

Import it into Postman/Insomnia or a frontend client generator.

## Check it works

Open `/docs/api`, find **POST /v1/auth/login**, click **Try it** with the admin credentials, copy `data.access`, set it as the Bearer token, and call **GET /v1/auth/me**.

Next: [12 · File uploads](/foundations/12-file-uploads)
