# 06 · Activity log

**Why:** "who changed this, and when?" must always have an answer. Every change is written to an `activity_log` table through **one** helper, and every server error is logged automatically.

## Install

```bash
composer require spatie/laravel-activitylog
php artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" --tag="activitylog-migrations"
php artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" --tag="activitylog-config"
php artisan migrate
```

## Our model

Extend Spatie's model so the log can be searched and sorted like everything else:

**`app/Models/ActivityLog.php`**

```php
<?php

namespace App\Models;

use App\Traits\Filterable;
use App\Traits\Searchable;
use App\Traits\Sortable;
use Illuminate\Database\Eloquent\Builder;
use Spatie\Activitylog\Models\Activity;

/**
 * Spatie's Activity model plus our query traits.
 * Registered in config/activitylog.php: 'activity_model' => \App\Models\ActivityLog::class
 */
class ActivityLog extends Activity
{
    use Filterable, Searchable, Sortable;

    public function getQueryConfig()
    {
        return (object) [
            'searchable' => ['description', 'log_name', 'event'],
            'filterable' => ['log_name' => 'log_name', 'event' => 'event'],
            'sortAliases' => ['d' => 'created_at'],
        ];
    }

    public function implementSort(Builder $query, string $column, $direction)
    {
        if ($column !== 'created_at') {
            return $query;
        }

        return $query->orderBy('created_at', strtolower($direction) === 'asc' ? 'asc' : 'desc');
    }
}
```

Register it in `config/activitylog.php`:

```php
'activity_model' => \App\Models\ActivityLog::class,
```

## The helper

**`app/Helpers/ActivityLogHelper.php`**

```php
<?php

namespace App\Helpers;

/**
 * One way to write the activity log, so every entry has the same shape.
 *
 * ActivityLogHelper::log([
 *     'log_name' => 'campus', 'event' => 'update', 'message' => '...',
 *     'changes' => [...], 'payload' => [...], 'response' => $response,
 *     'subject' => $campus,          // optional: the affected model
 *     'causer'  => $user,            // optional: defaults to the logged-in user
 * ]);
 */
class ActivityLogHelper
{
    public static function log(array $logData): void
    {
        $properties = [
            'action' => $logData['changes'] ?? null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'payload' => $logData['payload'] ?? null,
            'response' => $logData['response'] ?? null,
        ];

        if (empty($properties['action'])) {
            unset($properties['action']);
        }

        $log = activity($logData['log_name'])
            ->event($logData['event'])
            ->withProperties($properties);

        if (!empty($logData['causer'])) {
            $log->causedBy($logData['causer']);
        }

        if (!empty($logData['subject'])) {
            $log->performedOn($logData['subject']);
        }

        $log->log($logData['message']);
    }
}
```

Call it at the end of every service method that **changes** data:

```php
ActivityLogHelper::log([
    'log_name' => 'campus',
    'event'    => 'update',
    'message'  => "Updated campus '{$campus->name}' (ID: #{$campus->id})",
    'changes'  => $campus->getChanges(),
    'payload'  => $data,
    'response' => $response,
    'subject'  => $campus,
]);
```

What to pass and what never to log: [Activity logging](/architecture/activity-logging).

## Log every server error

**`app/Http/Middleware/ErrorLogMiddleware.php`**

```php
<?php

namespace App\Http\Middleware;

use App\Helpers\ActivityLogHelper;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Appended to the "api" middleware group: every 5xx response is written to the
 * activity log with the controller name, HTTP method and payload (secrets removed).
 */
class ErrorLogMiddleware
{
    private const HIDDEN = ['password', 'password_confirmation', 'current_password', 'refresh_token', 'token'];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($response->getStatusCode() >= 500) {
            $action = $request->route()?->getActionName() ?? '';
            $moduleName = ($action !== '' && $action !== 'Closure') ? class_basename($action) : 'system_route';

            $content = json_decode((string) $response->getContent(), true);
            $exception = $response->exception ?? null;
            $errorMessage = $content['message']
                ?? ($exception ? $exception->getMessage() : 'No response body or unknown error');

            ActivityLogHelper::log([
                'log_name' => $moduleName,
                'event' => $request->method(),
                'message' => 'Failed to complete the action',
                'changes' => null,
                'payload' => array_merge(
                    $request->except(self::HIDDEN),
                    $request->route()?->parameters() ?? []
                ),
                'response' => ['success' => false, 'message' => $errorMessage],
            ]);
        }

        return $response;
    }
}
```

Append it to the `api` middleware group in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->api(append: [\App\Http\Middleware\ErrorLogMiddleware::class]);
})
```

## The activity log endpoint

Admins read the log through an endpoint. It needs login, so you can only call it after step 09.

::: details Service, resource, controller and route
**`app/Services/v1/modules/ActivityLogService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Constants\UserRoles;
use App\Models\ActivityLog;

class ActivityLogService
{
    /**
     * Administrators see every entry; everyone else only the entries they caused.
     * Params: per_page, page, search, log_name, event, so ("d,asc|desc"; newest first by default).
     */
    public function viewPaginatedActivityLogsService($request)
    {
        $params = $request->all();
        $user = auth()->user();

        [$key, $requested] = array_pad(explode(',', strtolower((string) ($params['so'] ?? '')), 2), 2, '');
        $direction = $key === 'd' && trim($requested) === 'asc' ? 'asc' : 'desc';

        return ActivityLog::with('causer')
            ->when((int) $user->user_role_id !== UserRoles::ADMINISTRATOR, fn ($q) => $q
                ->where('causer_type', $user->getMorphClass())
                ->where('causer_id', $user->id))
            ->applySearch($params)
            ->applyFilterBy($params)
            ->applySort("d,{$direction}")
            ->orderBy('id', $direction)
            ->paginate($request['per_page'] ?? 10, ['*'], 'page', $request['page'] ?? 1);
    }
}
```

**`app/Http/Resources/v1/modules/activityLog/ActivityLogResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\activityLog;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'log_name' => $this->log_name,
            'event' => $this->event,
            'description' => $this->description,
            'causer' => $this->causer ? [
                'id' => $this->causer->id,
                'name' => trim("{$this->causer->first_name} {$this->causer->last_name}"),
                'email' => $this->causer->email,
            ] : null,
            'subject_type' => $this->subject_type ? class_basename($this->subject_type) : null,
            'subject_id' => $this->subject_id,
            'properties' => $this->properties,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
```

**`app/Http/Controllers/API/v1/modules/ActivityLogController.php`**

```php
<?php

namespace App\Http\Controllers\API\v1\modules;

use App\Http\Controllers\Controller;
use App\Http\Resources\v1\modules\activityLog\ActivityLogResource;
use App\Services\v1\modules\ActivityLogService;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /**
     * Get activity logs.
     *
     * Query params:
     * - per_page, page
     * - search: keyword in the description, log name or event
     * - log_name, event: exact filters
     * - so: "d,asc" or "d,desc" (created date). Newest first by default.
     *
     * @authenticated
     */
    public function viewPaginatedActivityLogs(Request $request, ActivityLogService $service)
    {
        try {
            return ActivityLogResource::collection($service->viewPaginatedActivityLogsService($request))
                ->additional(['success' => true, 'message' => 'Activity logs fetched successfully']);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }
}
```

**`routes/v1/modules/activityLog.php`**

```php
<?php

use App\Constants\UserRoles;
use App\Http\Controllers\API\v1\modules\ActivityLogController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/activity-log')->controller(ActivityLogController::class)
    ->middleware(['auth:api', 'role:' . UserRoles::roles(UserRoles::ADMINISTRATOR, UserRoles::STAFF)])
    ->group(function () {
        Route::get('/', 'viewPaginatedActivityLogs');
    });
```

:::

## Check it works

```bash
php artisan tinker
> App\Helpers\ActivityLogHelper::log(['log_name' => 'test', 'event' => 'check', 'message' => 'Hello log', 'changes' => [], 'payload' => [], 'response' => []])
> App\Models\ActivityLog::latest()->first()->description
= "Hello log"
```

Next: [07 · Roles & users](/foundations/07-roles-and-users)
