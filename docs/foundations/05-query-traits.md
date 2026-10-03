# 05 · Query traits

**Why:** every list endpoint needs search, filters and sorting. Three traits give all models the same query parameters:

```
GET /api/v1/campuses?search=main&active=1&so=n,desc&page=2&per_page=10
```

A model opts in by using the traits and describing itself in `getQueryConfig()`.

## The traits

**`app/Traits/Searchable.php`**

```php
<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * ?search=term  ->  WHERE (col1 LIKE %term% OR col2 LIKE %term% OR relation.col LIKE %term%)
 * Columns come from getQueryConfig()->searchable; "relation.column" searches a relation.
 */
trait Searchable
{
    public function scopeApplySearch(Builder $query, array $params)
    {
        $searchable = $this->getQueryConfig()->searchable ?? $this->getFillable();

        return $query->when($params['search'] ?? null, function ($q, $search) use ($searchable) {
            $q->where(function ($sub) use ($search, $searchable) {
                foreach ($searchable as $column) {
                    if (str_contains($column, '.')) {
                        [$relation, $relationColumn] = explode('.', $column);

                        $sub->orWhereHas($relation, function ($relationQuery) use ($relationColumn, $search) {
                            $relationQuery->where($relationColumn, 'like', "%{$search}%");
                        });
                    } else {
                        $sub->orWhere($column, 'like', "%{$search}%");
                    }
                }
            });
        });
    }
}
```

**`app/Traits/Filterable.php`**

```php
<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * ?key=value  ->  WHERE column = value, for every key listed in getQueryConfig()->filterable
 * (frontend key => database column). Unknown keys and empty values are ignored.
 */
trait Filterable
{
    public function scopeApplyFilterBy(Builder $query, array $params)
    {
        $filterable = $this->getQueryConfig()->filterable ?? [];

        $activeFilters = collect($params)
            ->only(array_keys($filterable))
            ->filter(fn ($value) => !is_null($value) && $value !== '');

        return $query->when($activeFilters->isNotEmpty(), function ($q) use ($activeFilters, $filterable) {
            foreach ($activeFilters as $frontendKey => $value) {
                $q->where($filterable[$frontendKey], $value);
            }
        });
    }
}
```

**`app/Traits/Sortable.php`**

```php
<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * ?so=alias,direction  ->  ORDER BY.
 * Resolution order: implement<Column>() on the model, then implementSort(), then a plain orderBy.
 * Always define implementSort() with an allow-list so unknown columns are ignored.
 */
trait Sortable
{
    public function scopeApplySort(Builder $query, $sorts)
    {
        if (is_string($sorts) && str_contains($sorts, ',')) {
            [$column, $direction] = explode(',', $sorts, 2);
            $sorts = [$column => $direction];
        }

        if (!is_array($sorts)) {
            return $query;
        }

        $aliases = $this->getQueryConfig()->sortAliases ?? [];

        foreach ($sorts as $sort => $value) {
            if (is_null($value)) {
                continue;
            }

            $column = $aliases[$sort] ?? $sort;
            $specificMethod = 'implement' . Str::studly($column);

            if (method_exists($this, $specificMethod)) {
                $this->$specificMethod($query, $value);
            } elseif (method_exists($this, 'implementSort')) {
                $this->implementSort($query, $column, $value);
            } else {
                $query->orderBy($column, strtolower($value) === 'desc' ? 'desc' : 'asc');
            }
        }

        return $query;
    }
}
```


## Using them in a model

```php
use App\Traits\Filterable;
use App\Traits\Searchable;
use App\Traits\Sortable;
use Illuminate\Database\Eloquent\Builder;

class Campus extends Model
{
    use Filterable, Searchable, Sortable;

    public function getQueryConfig()
    {
        return (object) [
            'searchable'  => ['code', 'name'],                 // ?search=
            'filterable'  => ['active' => 'is_active'],        // ?active=1
            'sortAliases' => ['c' => 'code', 'n' => 'name'],   // ?so=n,desc
        ];
    }

    /** Allow-list: unknown sort columns are ignored instead of reaching SQL. */
    public function implementSort(Builder $query, string $column, $direction)
    {
        if (!in_array($column, ['code', 'name'], true)) {
            return $query;
        }

        return $query->orderBy($column, strtolower($direction) === 'desc' ? 'desc' : 'asc');
    }
}
```

Details and pitfalls: [Search, filter & sort](/guides/search-filter-sort).

## Check it works

After step 07 (the `User` model uses the traits):

```bash
php artisan tinker
> App\Models\User::applySearch(['search' => 'admin'])->applySort('e,desc')->toRawSql()
```

prints the SQL with a `LIKE '%admin%'` group and `order by email desc`.

Next: [06 · Activity log](/foundations/06-activity-log)
