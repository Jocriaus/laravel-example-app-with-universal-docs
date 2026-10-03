# Activity logging

Every change a user makes is written to the `activity_log` table (spatie/laravel-activitylog) through one helper, so all entries have the same shape.

## `ActivityLogHelper::log()`

Call it at the end of every service method that **changes** data.

```php
use App\Helpers\ActivityLogHelper;

ActivityLogHelper::log([
    'log_name' => 'campus',                       // feature name, used for filtering
    'event'    => 'update',                       // create | update | delete | custom verb
    'message'  => "Updated campus '{$campus->name}' (ID: #{$campus->id})",
    'changes'  => $campus->getChanges(),          // what changed; [] if nothing to show
    'payload'  => $data,                          // what the client sent
    'response' => $response,                      // what we answered
    'subject'  => $campus,                        // the model the action affected
    // 'causer' => $user,                         // optional: defaults to the logged-in user
]);
```

| Key | Required | Notes |
|---|---|---|
| `log_name` | yes | One name per feature (`user_group`, `auth`, `profile`, `campus`) |
| `event` | yes | Verb. Auth uses upper-case names (`USER_LOGIN`, `REFRESH_TOKEN_REUSE_DETECTED`) so they are easy to search |
| `message` | yes | Human sentence shown in the audit screen |
| `changes` | yes | Pass `[]` when there is nothing to show; empty values are dropped |
| `payload` | yes | Never include passwords or tokens |
| `response` | yes | The object or array the service returns |
| `subject` | no | The affected model |
| `causer` | no | Set it when nobody is logged in yet (login) |

The helper also records the client IP and user agent.

## What to pass as `changes`

| Action | `changes` |
|---|---|
| create | `$model->toArray()` |
| update | `$model->getChanges()` (call **after** `save()`) |
| delete | `['deleted' => [...]]` or `[]` |
| sync (members, permissions) | counts: `['attached' => [...], 'detached' => [...]]` |

## What not to log

- **Reads.** Lists and "view one" are not logged.
- **Token refreshes.** They happen every few minutes per open tab; only failures and reuse detection are logged.
- **Secrets.** Never put passwords, tokens or the pepper in `payload` or `changes`.

## Automatic error logging

`ErrorLogMiddleware` is appended to the `api` middleware group in `bootstrap/app.php`. Any response with status 500 or higher is logged with `log_name` = the controller class, `event` = the HTTP method, and the request payload minus `password` and `password_confirmation`.

## Reading the log

`GET /api/v1/activity-log` (Admin and Staff roles). Administrators see everything; everyone else sees only entries they caused. Supports `search`, `log_name`, `event`, `per_page`, `page` and `so=d,asc|desc`.
