# API resources

Returning a model directly (`return $campus;`) exposes **every** column, now and in the future. A **resource** decides exactly what the client sees.

```bash
php artisan make:resource CampusResource
```

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CampusResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'is_active' => $this->is_active,
            'colleges' => CollegeResource::collection($this->whenLoaded('colleges')),
            'colleges_count' => $this->whenCounted('colleges'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
```

- `$this->...` reads from the underlying model.
- `whenLoaded('colleges')` only includes the relation if the query eager-loaded it (no hidden extra queries).

## One record

```php
return CampusResource::make($campus);
// {"data": {"id": 1, "code": "MAIN", ...}}
```

The `data` wrapper is added by default. Remove it for one resource class with `public static $wrap = null;`.

## Collections and pagination

```php
return CampusResource::collection(Campus::paginate(10));
```

With a paginator you automatically get `data`, `links` and `meta` (current page, last page, total...).

## Adding top-level fields

```php
return CampusResource::collection($paginator)->additional([
    'success' => true,
    'message' => 'Campuses fetched successfully',
]);
```

This is how list endpoints in these docs add the standard envelope.

Next: [Middleware](/laravel-basics/middleware)
