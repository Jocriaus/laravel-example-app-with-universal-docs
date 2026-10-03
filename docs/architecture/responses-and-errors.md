# Responses & errors

Every endpoint answers with the same envelope so the frontend can handle responses in one place.

## Success

### Action without data (create, update, delete)

The service returns an object, the controller wraps it in `GlobalResponseResource`:

```php
// Service
return (object) [
    'success' => true,
    'message' => "Campus 'Main' created successfully!",
];

// Controller
return new GlobalResponseResource($response);
```

```json
{ "success": true, "message": "Campus 'Main' created successfully!" }
```

`GlobalResponseResource` has `$wrap = null`, so there is no extra `data` key.

### Single record

```php
return response()->json([
    'success' => true,
    'message' => 'Campus retrieved successfully',
    'data' => CampusResource::make($campus),
], 200);
```

### Paginated list

Return a resource collection and add the envelope fields with `additional()`:

```php
return CampusResource::collection($paginator)->additional([
    'success' => true,
    'message' => 'Campuses fetched successfully',
]);
```

Laravel adds `data`, `links` and `meta` (`current_page`, `last_page`, `per_page`, `total`, ...):

```json
{
  "data": [ { "id": 1, "name": "Main" } ],
  "links": { "first": "...", "last": "...", "prev": null, "next": null },
  "meta": { "current_page": 1, "last_page": 1, "per_page": 10, "total": 1 },
  "success": true,
  "message": "Campuses fetched successfully"
}
```

## Errors

Errors are always `{ "success": false, "message": "..." }`, with a status code that tells the frontend what to do.

| Status | Meaning | Thrown by | Frontend should |
|---|---|---|---|
| 400 | Business rule broken | `throw new InvalidException('...')` in a service | show the message |
| 401 | Not logged in / session over | `auth:api`, refresh endpoint | refresh once, else go to login |
| 403 | Logged in but not allowed | `role`, `module.permission`, origin check | show "no access" |
| 404 | Record not found | `findOrFail()` → `ModelNotFoundException` | show "not found" |
| 409 | Parallel refresh | refresh endpoint | retry the request |
| 422 | Invalid input | FormRequest | show the message next to the form |
| 500 | Bug | anything else | show a generic error |

### Validation errors (422)

Every FormRequest overrides `failedValidation()` so validation errors use the envelope, with the **first** error as the message:

```php
protected function failedValidation(Validator $validator)
{
    $response = [
        'success' => false,
        'message' => $validator->errors()->first(),
    ];

    throw new HttpResponseException(
        response()->json(new GlobalResponseResource((object) $response), 422)
    );
}
```

### Business errors (400)

Throw `InvalidException` from the service; the controller turns it into a 400:

```php
// Service
if ($group->members()->exists()) {
    throw new InvalidException('Cannot delete a user group that still contains active members.');
}

// Controller
} catch (InvalidException $e) {
    return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
}
```

### Unexpected errors (500)

Always the last `catch` in a controller. Hide the real message in production:

```php
} catch (\Exception $e) {
    return response()->json([
        'success' => false,
        'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
    ], 500);
}
```

`ErrorLogMiddleware` then writes every 5xx to the activity log with the controller name, the HTTP method and the request payload (passwords removed).

::: tip Catch order matters
Put specific exceptions first (`ModelNotFoundException`, `InvalidException`) and `\Exception` last. PHP uses the first matching `catch`.
:::
