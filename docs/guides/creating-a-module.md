# Creating a module

This guide builds a complete **Campus** CRUD module, one file at a time. Every other module follows the same pattern.

**End result**

| Method & path | Permission (`Campus Setup` · ...) |
|---|---|
| `GET /api/v1/campuses` | View |
| `GET /api/v1/campuses/{id}` | View |
| `POST /api/v1/campuses` | Create |
| `PATCH /api/v1/campuses/{id}` | Update |
| `DELETE /api/v1/campuses/{id}` | Delete |

**Files you will create**

```
database/migrations/2026_10_05_000001_create_campuses_table.php
app/Models/Campus.php
app/Http/Requests/CampusRequest.php
app/Services/v1/modules/CampusService.php
app/Http/Resources/v1/modules/campus/CampusResource.php
app/Http/Controllers/API/v1/modules/CampusController.php
routes/v1/modules/campus.php
```

## Step 0: Names

Decide the names once and use them everywhere:

| Thing | Convention | Campus example |
|---|---|---|
| Table | plural snake case | `campuses` |
| Model | singular StudlyCase | `Campus` |
| URL | plural kebab case | `/v1/campuses` |
| Route file | camelCase feature | `campus.php` |
| Controller methods | verb + noun | `viewCampuses`, `getCampus`, `createCampus`, `updateCampus`, `deleteCampus` |
| Service methods | controller method + `Service` | `viewCampusesService`, `createCampusService`, ... |
| `log_name` | snake case feature | `campus` |

## Step 1: Permission

The sub-module must exist before a route can require it. `Campus Setup` is already in `database/seeders/data/rbac.php`:

```php
'Setup Manager' => [
    'Campus Setup' => ['View', 'Create', 'Update', 'Delete'],
    // ...
],
```

and in `App\Constants\SubModules::CAMPUS_SETUP`. For a brand-new feature, add both first; see [Seeding permissions](/guides/seeding-rbac).

## Step 2: Migration

```bash
php artisan make:migration create_campuses_table
```

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campuses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 150);
            $table->string('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campuses');
    }
};
```

```bash
php artisan migrate
```

::: warning Time columns on MySQL
Use `timestamps()` / `softDeletes()` (nullable) freely. For a **required** time column use `dateTime()`, not `timestamp()`: some MySQL servers reject or auto-update `NOT NULL TIMESTAMP` columns.
:::

## Step 3: Model

```bash
php artisan make:model Campus
```

```php
<?php

namespace App\Models;

use App\Traits\Filterable;
use App\Traits\Searchable;
use App\Traits\Sortable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Campus extends Model
{
    use SoftDeletes, Filterable, Searchable, Sortable;

    protected $fillable = ['code', 'name', 'address', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** Read by the Searchable / Filterable / Sortable traits. */
    public function getQueryConfig()
    {
        return (object) [
            'searchable' => ['code', 'name'],                 // ?search=
            'filterable' => ['active' => 'is_active'],        // ?active=1
            'sortAliases' => ['c' => 'code', 'n' => 'name'],  // ?so=n,asc
        ];
    }

    /** Allow-list for sorting: anything else is ignored. */
    public function implementSort(Builder $query, string $column, $direction)
    {
        if (!in_array($column, ['code', 'name'], true)) {
            return $query;
        }

        return $query->orderBy($column, strtolower($direction) === 'desc' ? 'desc' : 'asc');
    }
}
```

How the three traits work: [Search, filter & sort](/guides/search-filter-sort).

## Step 4: Form request

```bash
php artisan make:request CampusRequest
```

```php
<?php

namespace App\Http\Requests;

use App\Http\Resources\GlobalResponseResource;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/** POST creates (all required); PATCH updates (only the fields sent). */
class CampusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        $required = $this->isMethod('patch') ? 'sometimes' : 'required';

        return [
            // @example MAIN
            'code' => [$required, 'string', 'max:20',
                Rule::unique('campuses', 'code')->ignore($this->route('id'))->whereNull('deleted_at')],
            // @example Main Campus
            'name' => [$required, 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => [$required, 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'This campus code is already in use.',
        ];
    }

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
}
```

- **`authorize()`** only checks that someone is logged in. The actual permission is on the route.
- **`// @example`** comments feed the generated API docs.
- **`failedValidation()`** keeps validation errors in the standard envelope. Copy it into every request.

## Step 5: Service

```bash
php artisan make:service v1/modules/CampusService
```

That creates `app/Services/v1/modules/CampusService.php` from `stubs/service.stub`. Replace the example method:

```php
<?php

namespace App\Services\v1\modules;

use App\Exceptions\InvalidException;
use App\Helpers\ActivityLogHelper;
use App\Models\Campus;

class CampusService
{
    public function __construct()
    {
        // Constructor logic if needed
    }

    /** Params: per_page, page, search, active, so ("c|n,asc|desc"). */
    public function viewCampusesService($request)
    {
        $params = $request->all();

        [$key, $direction] = array_pad(explode(',', strtolower((string) ($params['so'] ?? '')), 2), 2, '');

        return Campus::query()
            ->applySearch($params)
            ->applyFilterBy($params)
            ->when(in_array($key, ['c', 'n'], true),
                fn ($q) => $q->applySort("{$key}," . (trim($direction) === 'desc' ? 'desc' : 'asc')))
            ->orderBy('id')   // tie-breaker: rows never jump between pages
            ->paginate($request['per_page'] ?? 10, ['*'], 'page', $request['page'] ?? 1);
    }

    public function getCampusService($id)
    {
        return (object) [
            'success' => true,
            'message' => 'Campus retrieved successfully',
            'data' => Campus::findOrFail($id),
        ];
    }

    public function createCampusService(array $data)
    {
        $campus = Campus::create($data);

        $response = (object) [
            'success' => true,
            'message' => "Campus '{$campus->name}' created successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'campus',
            'event' => 'create',
            'message' => "Created campus '{$campus->name}' (ID: #{$campus->id}).",
            'changes' => $campus->toArray(),
            'payload' => $data,
            'response' => $response,
            'subject' => $campus,
        ]);

        return $response;
    }

    public function updateCampusService(array $data)
    {
        $campus = Campus::findOrFail($data['id']);
        $campus->fill($data);

        if (!$campus->isDirty()) {
            return (object) [
                'success' => true,
                'message' => 'No changes were made to the campus.',
            ];
        }

        $campus->save();

        $response = (object) [
            'success' => true,
            'message' => "Campus '{$campus->name}' updated successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'campus',
            'event' => 'update',
            'message' => "Updated campus '{$campus->name}' (ID: #{$campus->id}).",
            'changes' => $campus->getChanges(),
            'payload' => $data,
            'response' => $response,
            'subject' => $campus,
        ]);

        return $response;
    }

    public function deleteCampusService($id)
    {
        $campus = Campus::findOrFail($id);

        // Business rule example: throw InvalidException -> controller answers 400.
        // if ($campus->colleges()->exists()) {
        //     throw new InvalidException('Cannot delete a campus that still has colleges.');
        // }

        $campus->delete(); // soft delete

        $response = (object) [
            'success' => true,
            'message' => "Campus '{$campus->name}' deleted successfully!",
        ];

        ActivityLogHelper::log([
            'log_name' => 'campus',
            'event' => 'delete',
            'message' => "Deleted campus '{$campus->name}' (ID: #{$id}).",
            'changes' => [],
            'payload' => ['id' => $id],
            'response' => $response,
            'subject' => $campus,
        ]);

        return $response;
    }
}
```

**Rules for services**

- Receive plain arrays (`$request->validated()` + route params), never read headers or cookies.
- Return `(object) ['success' => ..., 'message' => ...]` for actions, a paginator for lists.
- Throw `InvalidException` for broken business rules and let `findOrFail()` throw for missing records.
- Log every change with `ActivityLogHelper::log()`.
- Wrap multi-table writes in `DB::transaction(...)`.

## Step 6: Resource

```bash
php artisan make:resource v1/modules/campus/CampusResource
```

```php
<?php

namespace App\Http\Resources\v1\modules\campus;

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
            'address' => $this->address,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
```

Only fields listed here reach the client, so adding a column to the table never leaks it by accident.

## Step 7: Controller

```bash
php artisan make:controller API/v1/modules/CampusController
```

```php
<?php

namespace App\Http\Controllers\API\v1\modules;

use App\Exceptions\InvalidException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CampusRequest;
use App\Http\Resources\GlobalResponseResource;
use App\Http\Resources\v1\modules\campus\CampusResource;
use App\Services\v1\modules\CampusService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;

class CampusController extends Controller
{
    /**
     * Retrieve all campuses.
     *
     * Query params:
     * - per_page: items per page (default 10)
     * - page: page number (default 1)
     * - search: keyword to search by code or name
     * - active: filter by status (1 / 0)
     * - so: sort as "key,direction". Keys: "c" (code), "n" (name).
     *
     * Example: /v1/campuses?per_page=10&page=1&search=main&so=n,asc
     *
     * @authenticated
     */
    public function viewCampuses(Request $request, CampusService $service)
    {
        try {
            $request->merge([
                'per_page' => $request->input('per_page', 10),
                'page' => $request->input('page', 1),
                'search' => $request->input('search', ''),
                'so' => $request->input('so', ''),
            ]);

            return CampusResource::collection($service->viewCampusesService($request))->additional([
                'success' => true,
                'message' => 'Campuses fetched successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Get a campus.
     *
     * @authenticated
     */
    public function getCampus($id, CampusService $service)
    {
        try {
            $response = $service->getCampusService($id);

            return response()->json([
                'success' => $response->success,
                'message' => $response->message,
                'data' => CampusResource::make($response->data),
            ], 200);
        } catch (ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Campus not found.'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Create a campus.
     *
     * @authenticated
     */
    public function createCampus(CampusRequest $request, CampusService $service)
    {
        try {
            return new GlobalResponseResource($service->createCampusService($request->validated()));
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Update a campus.
     *
     * Send only the fields to change.
     *
     * @authenticated
     */
    public function updateCampus(CampusRequest $request, $id, CampusService $service)
    {
        try {
            $validatedRequest = array_merge($request->validated(), ['id' => $id]);

            return new GlobalResponseResource($service->updateCampusService($validatedRequest));
        } catch (ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Campus not found.'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }

    /**
     * Delete a campus.
     *
     * @authenticated
     */
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
}
```

- The **docblock** first line is the endpoint title in the API docs; the paragraph is its description. `@authenticated` marks it as needing a token.
- The service is **injected per method** (`CampusService $service`); Laravel builds it.
- Route parameters are **merged** into the validated array before calling the service.

## Step 8: Routes

Create `routes/v1/modules/campus.php`. It is loaded automatically.

```php
<?php

use App\Constants\ModuleActions;
use App\Constants\SubModules;
use App\Http\Controllers\API\v1\modules\CampusController;
use App\Http\Middleware\ModulePermissionMiddleware as Permission;
use Illuminate\Support\Facades\Route;

$can = fn (string $action) => ['auth:api', Permission::using(SubModules::CAMPUS_SETUP, $action)];

Route::prefix('v1/campuses')->controller(CampusController::class)->group(function () use ($can) {
    Route::get('/', 'viewCampuses')->middleware($can(ModuleActions::VIEW));
    Route::post('/', 'createCampus')->middleware($can(ModuleActions::CREATE));
    Route::get('/{id}', 'getCampus')->whereNumber('id')->middleware($can(ModuleActions::VIEW));
    Route::patch('/{id}', 'updateCampus')->whereNumber('id')->middleware($can(ModuleActions::UPDATE));
    Route::delete('/{id}', 'deleteCampus')->whereNumber('id')->middleware($can(ModuleActions::DELETE));
});
```

```bash
php artisan route:list --path=campuses
```

::: tip Put fixed paths before `{id}`
Register `/stats` or `/dropdown` before `/{id}`, and keep `->whereNumber('id')`, so `/campuses/stats` is never read as id `stats`.
:::

## Step 9: Try it

```http
### Log in (copy data.access)
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json
X-Requested-With: XMLHttpRequest

{ "email": "admin@email.com", "password": "admin" }

### Create
POST http://localhost:8000/api/v1/campuses
Authorization: Bearer <access>
Accept: application/json
Content-Type: application/json

{ "code": "MAIN", "name": "Main Campus", "is_active": true }

### List
GET http://localhost:8000/api/v1/campuses?search=main&so=n,asc
Authorization: Bearer <access>
Accept: application/json
```

Then open `/docs/api`: the Campus endpoints appear with their parameters, generated from the request rules and docblocks.

To check the permission, log in as a user whose group does **not** have `Campus Setup · Create`. `POST /campuses` must return 403.

## Step 10: Test it

A starting point for a Pest feature test in `tests/Feature/CampusTest.php`:

```php
<?php

use App\Models\Campus;
use App\Models\User;

beforeEach(function () {
    $this->seed();                                   // roles, admin user, RBAC
    $this->admin = User::where('email', 'admin@email.com')->first();
});

it('creates a campus', function () {
    $this->actingAs($this->admin, 'api')
        ->postJson('/api/v1/campuses', ['code' => 'MAIN', 'name' => 'Main Campus', 'is_active' => true])
        ->assertOk()
        ->assertJson(['success' => true]);

    expect(Campus::where('code', 'MAIN')->exists())->toBeTrue();
});

it('rejects a duplicate code', function () {
    Campus::create(['code' => 'MAIN', 'name' => 'Main', 'is_active' => true]);

    $this->actingAs($this->admin, 'api')
        ->postJson('/api/v1/campuses', ['code' => 'MAIN', 'name' => 'Other', 'is_active' => true])
        ->assertStatus(422)
        ->assertJson(['success' => false, 'message' => 'This campus code is already in use.']);
});
```

## Checklist

Before opening a pull request for a new module:

- [ ] Sub-module and actions exist in `data/rbac.php` and in `SubModules`
- [ ] Migration uses `softDeletes()` if records may be restored
- [ ] Model has `$fillable`, casts, `getQueryConfig()` and an `implementSort()` allow-list
- [ ] Request has `failedValidation()`, `@example` comments, and `sometimes` for PATCH
- [ ] Service holds **all** logic, returns `{success, message}` objects, logs every change
- [ ] Resource lists every field explicitly
- [ ] Controller catches `ModelNotFoundException`, `InvalidException`, then `\Exception`
- [ ] Every route has `auth:api` and a `Permission::using(...)`
- [ ] Endpoints appear correctly in `/docs/api`
- [ ] Happy path and one failure path are tested

For a bigger example with sync endpoints, stats and nested resources, read the **user group** module: `UserGroupController`, `UserGroupService`, `UserGroupMemberService`, `UserGroupPermissionService`.

Want server-rendered pages for the same feature? [A Blade (full-stack) module](/guides/blade-module) reuses `CampusService` with Blade views.
