# 03 · Responses & errors

**Why:** the frontend should handle every response the same way. Decide the JSON envelope and the meaning of every status code **once**.

## The envelope

```json
{ "success": true,  "message": "Campus 'Main' created successfully!" }
{ "success": true,  "message": "Campus retrieved successfully", "data": { ... } }
{ "success": true,  "message": "Campuses fetched successfully", "data": [ ... ], "links": { ... }, "meta": { ... } }
{ "success": false, "message": "The name field is required." }
```

| Status | Meaning | Raised by |
|---|---|---|
| 200 / 201 | worked | controller |
| 400 | business rule broken | `throw new InvalidException('...')` in a service |
| 401 | not logged in / session over | `auth:api`, `UnauthorizedException` |
| 403 | not allowed | role / permission middleware |
| 404 | not found | `findOrFail()` → `ModelNotFoundException` |
| 409 | conflict / race | refresh endpoint |
| 422 | invalid input | FormRequest |
| 429 | too many requests | `throttle` |
| 500 | bug | anything else |

## Files

**`app/Http/Resources/GlobalResponseResource.php`**

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The { success, message } envelope for actions that return no data.
 * Wrap the object a service returns: new GlobalResponseResource($response)
 */
class GlobalResponseResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'success' => $this->success,
            'message' => $this->message,
        ];
    }
}
```

**`app/Exceptions/InvalidException.php`**

```php
<?php

namespace App\Exceptions;

use Exception;

/** A business rule was broken. Controllers answer 400 with the message. */
class InvalidException extends Exception
{
    public function __construct($message = "Invalid", $code = 400, ?Exception $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
```

**`app/Exceptions/UnauthorizedException.php`**

```php
<?php

namespace App\Exceptions;

use Exception;

/** The caller is not (or no longer) authenticated. Controllers answer 401. */
class UnauthorizedException extends Exception
{
    public function __construct($message = "Unauthorized", $code = 401, ?Exception $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
```


## Errors on `/api/*` are always JSON

Without an `Accept: application/json` header Laravel renders errors as HTML pages. Force JSON for the API in `bootstrap/app.php`:

```php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->shouldRenderJsonWhen(
        fn ($request, $e) => $request->is('api/*') || $request->expectsJson()
    );
})
```

## Validation errors in the envelope

Laravel's default 422 body is `{ "message": ..., "errors": {...} }`. Every FormRequest overrides `failedValidation()` to answer with the envelope and the **first** error:

```php
use App\Http\Resources\GlobalResponseResource;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

protected function failedValidation(Validator $validator)
{
    throw new HttpResponseException(response()->json(
        new GlobalResponseResource((object) ['success' => false, 'message' => $validator->errors()->first()]),
        422
    ));
}
```

## The controller pattern

Services return an object (`success`, `message`, maybe `data`). Controllers wrap it and map exceptions, specific first:

```php
public function deleteCampus($id, CampusService $service)
{
    try {
        return new GlobalResponseResource($service->deleteCampusService($id));
    } catch (ModelNotFoundException $e) {
        return response()->json(['success' => false, 'message' => 'Campus not found.'], 404);
    } catch (InvalidException $e) {
        return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
        ], 500);
    }
}
```

::: warning Never leak internals
The last `catch` hides the real message unless `APP_DEBUG=true`. The full error is still in `storage/logs/laravel.log` (and in the activity log after step 06).
:::

## Check it works

```bash
curl -i http://127.0.0.1:8000/api/v1/does-not-exist
```

returns `404` with a **JSON** body, even without an `Accept` header.

Next: [04 · make:service](/foundations/04-make-service)
