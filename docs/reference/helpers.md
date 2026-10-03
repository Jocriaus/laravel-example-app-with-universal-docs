# Helpers

Small, reusable utilities in `app/Helpers` and `app/Support`. Business rules belong in services, not here.

## `ActivityLogHelper`

`ActivityLogHelper::log(array $logData): void`. Writes one activity log entry with the IP and user agent. See [Activity logging](/architecture/activity-logging).

## `FileUploadHelper`

| Method | Returns |
|---|---|
| `fileUpload(UploadedFile $file, string $feature, ?string $identifier = null, ?string $customFilename = null)` | the created `FileUpload` row; the file is stored on the private disk under a UUID name |
| `delete(?FileUpload $file)` | removes the file from disk and its row |
| `fileSize(?FileUpload $file)` | bytes, or `null` if missing |
| `humanReadableSize(?int $bytes)` | `"1.2 MB"` |

See [File uploads](/foundations/12-file-uploads).

## `app/Support`

Framework-free classes: easy to unit test.

| Class | Use |
|---|---|
| `Rbac\PermissionMatrix` | expands permission patterns from `data/rbac.php` (`'*'`, per module, per sub-module) and rejects unknown names |
| `Auth\ClientInfo` | IP (validated) and user agent of a request |
| `Auth\IssuedTokens` | result of login / refresh: access token, `access_expires_in`, raw refresh token, expiry, session row |

## Laravel helpers you'll use constantly

| Helper | Example |
|---|---|
| `config()` | `config('auth.jwt_ttl')` |
| `now()` | `now()->addMinutes(15)` (a Carbon date in the app time zone, UTC) |
| `auth()` | `auth()->user()`, `auth('web')->check()` |
| `request()` | `request()->ip()` |
| `route()` / `url()` | `route('campuses.index')` |
| `Str::` | `Str::uuid()`, `Str::random(64)`, `Str::limit($text, 100)` |
| `collect()` | `collect($rows)->pluck('id')` |
| `abort()` | `abort(404)` |
| `logger()` | `logger('Imported', ['count' => $n])` |
| `dd()` / `dump()` | debugging only, never committed |
