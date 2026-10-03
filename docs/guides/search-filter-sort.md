# Search, filter & sort

Three traits in `app/Traits` give every list endpoint the same query parameters. A model opts in by using the traits and describing itself in `getQueryConfig()`.

```php
use App\Traits\Filterable;
use App\Traits\Searchable;
use App\Traits\Sortable;

class Campus extends Model
{
    use Filterable, Searchable, Sortable;

    public function getQueryConfig()
    {
        return (object) [
            'searchable'  => ['code', 'name', 'college.name'],   // ?search=
            'filterable'  => ['active' => 'is_active'],          // ?active=1
            'sortAliases' => ['c' => 'code', 'n' => 'name'],     // ?so=n,desc
        ];
    }
}
```

## `?search=` (Searchable)

`scopeApplySearch($params)` wraps an `OR` group of `LIKE %term%` conditions over every column in `searchable`.

- `'name'` searches the model's own column.
- `'college.name'` (a dot) means **relation.column**: it becomes `orWhereHas('college', ...)`.

::: warning Dots always mean relations
`'campuses.name'` is read as relation `campuses`, column `name`, and fails. When the query has joins and you need a qualified column, filter manually instead of listing it in `searchable`.
:::

If `searchable` is missing, the trait falls back to `$fillable`.

## `?<key>=` (Filterable)

`scopeApplyFilterBy($params)` maps **frontend keys** to **columns** and adds `where(column, value)` for every key present and not empty.

```php
'filterable' => [
    'uri'    => 'user_role_id',   // ?uri=2  -> where user_role_id = 2
    'active' => 'is_active',      // ?active=0 -> where is_active = 0
],
```

Short keys keep URLs compact and hide column names. Keys that are not listed are ignored.

## `?so=key,direction` (Sortable)

`scopeApplySort("key,direction")` resolves the alias, then calls, in order:

1. `implement<Column>()` on the model if it exists (e.g. `implementFullName()` for a computed sort),
2. otherwise `implementSort($query, $column, $direction)`,
3. otherwise a plain `orderBy`.

Always define `implementSort()` with an **allow-list**. Without it an unknown key reaches `orderBy` and becomes a "column not found" error:

```php
public function implementSort(Builder $query, string $column, $direction)
{
    if (!in_array($column, ['code', 'name'], true)) {
        return $query;
    }

    return $query->orderBy($column, strtolower($direction) === 'desc' ? 'desc' : 'asc');
}
```

## Putting it together in a service

```php
public function viewCampusesService($request)
{
    $params = $request->all();

    [$key, $direction] = array_pad(explode(',', strtolower((string) ($params['so'] ?? '')), 2), 2, '');

    return Campus::query()
        ->applySearch($params)
        ->applyFilterBy($params)
        ->when(in_array($key, ['c', 'n'], true),
            fn ($q) => $q->applySort("{$key}," . (trim($direction) === 'desc' ? 'desc' : 'asc')))
        ->orderBy('id')
        ->paginate($request['per_page'] ?? 10, ['*'], 'page', $request['page'] ?? 1);
}
```

- **Check the key** before calling `applySort`: nothing validates `so` on the way in.
- **Always end with `orderBy('id')`.** Without a unique tie-breaker, rows with the same sort value can move between pages.
- **`paginate(per_page, ['*'], 'page', page)`** reads the values the controller merged into the request.

## Documenting the parameters

List them in the controller docblock so they show up in `/docs/api`:

```php
/**
 * Retrieve all campuses.
 *
 * Query params:
 * - search: keyword to search by code or name
 * - active: filter by status (1 / 0)
 * - so: sort as "key,direction". Keys: "c" (code), "n" (name).
 *
 * @authenticated
 */
```
