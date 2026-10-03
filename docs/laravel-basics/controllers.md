# Controllers

A controller groups the actions of one feature. Its job is to **translate HTTP**: read the input, call the code that does the work, and return a response.

```bash
php artisan make:controller CampusController
```

```php
<?php

namespace App\Http\Controllers;

use App\Models\Campus;
use Illuminate\Http\Request;

class CampusController extends Controller
{
    public function index(Request $request)
    {
        return Campus::paginate($request->input('per_page', 10));
    }

    public function show($id)
    {
        return Campus::findOrFail($id);
    }
}
```

## Reading input

```php
$request->input('name');             // body or query string
$request->input('per_page', 10);     // with a default
$request->query('page');             // query string only
$request->boolean('is_active');      // "1", "true", "on" -> true
$request->all();                     // everything (don't pass this to create()!)
$request->validated();               // only validated fields (FormRequest)
$request->user();                    // the authenticated user
$request->bearerToken();             // the token from "Authorization: Bearer ..."
$request->cookie('refresh_token');
$request->file('signature');         // an uploaded file
```

## Returning responses

```php
return ['ok' => true];                                   // array -> JSON, 200
return response()->json(['message' => 'Created'], 201); // explicit status
return CampusResource::make($campus);                    // API resource
return response()->noContent();                          // 204
```

## Method injection

Anything you type-hint in a controller method is built for you by the **service container**: the request, a form request, a service class...

```php
public function store(CampusRequest $request, CampusService $service)
{
    return $service->create($request->validated());
}
```

That is how controllers in these docs receive their service. See [Service container](/laravel-basics/service-container).

## Keep controllers thin

| Controller does | Controller does not |
|---|---|
| read validated input | run queries |
| call **one** service method | enforce business rules |
| choose the status code | send emails, write logs |
| catch exceptions and map them to responses | know table or column names |

Everything in the right-hand column goes in a **service**. The pattern is covered in [Foundations](/foundations/01-folder-conventions) and [Creating a module](/guides/creating-a-module).

Next: [Validation & form requests](/laravel-basics/validation)
