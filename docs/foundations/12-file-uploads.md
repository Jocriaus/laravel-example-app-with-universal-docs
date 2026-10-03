# 12 · File uploads

**Why:** files such as signatures, IDs or attachments must not be public. They go to a **private** disk, are recorded in a table, and are served through a controller or a **temporary signed URL**.

## 1. A private disk

In `config/filesystems.php`, add to `disks`:

```php
'private' => [
    'driver' => 'local',
    'root' => storage_path('app/private'),
    'visibility' => 'private',
    'throw' => false,
],
```

Nothing under `storage/app/private` is reachable by URL.

## 2. Table and model

```bash
php artisan make:migration create_file_uploads_table
php artisan make:migration add_signature_to_users_table
```

**`database/migrations/2026_10_01_000030_create_file_uploads_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_uploads', function (Blueprint $table) {
            $table->id();
            $table->string('filename');                    // original name, shown to users
            $table->uuid('storage_filename')->unique();    // name on disk (without extension), used in URLs
            $table->string('file_type', 100);              // MIME type
            $table->string('file_path');                   // path on the private disk
            $table->string('file_extension', 20)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_uploads');
    }
};
```

**`database/migrations/2026_10_01_000031_add_signature_to_users_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('signature_id')->nullable()->after('is_active')
                ->constrained('file_uploads')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('signature_id');
        });
    }
};
```

**`app/Models/FileUpload.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FileUpload extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'filename',
        'storage_filename',
        'file_type',
        'file_path',
        'file_extension',
    ];

    /** Name to offer when downloading: the original name with its extension. */
    public function downloadName(): string
    {
        $name = $this->filename ?: $this->storage_filename;

        return $this->file_extension && !str_ends_with(strtolower($name), '.' . strtolower($this->file_extension))
            ? "{$name}.{$this->file_extension}"
            : $name;
    }
}
```

In `app/Models/User.php`, add `'signature_id'` to `$fillable` and the relation:

```php
public function signature(): BelongsTo
{
    return $this->belongsTo(FileUpload::class, 'signature_id');
}
```

## 3. Storing files

**`app/Helpers/FileUploadHelper.php`**

```php
<?php

namespace App\Helpers;

use App\Models\FileUpload;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploadHelper
{
    /** Folder per feature under uploads/. Add a line when a feature needs its own folder. */
    private const FOLDERS = [
        'signature' => 'signatures',
    ];

    /**
     * Store a validated upload on the private disk and record it in file_uploads.
     * Path: uploads/<folder>/<YYYY>/<MM>[/<identifier>]/<uuid>.<ext>
     */
    public static function fileUpload(UploadedFile $file, string $feature, ?string $identifier = null, ?string $customFilename = null): FileUpload
    {
        $folder = self::FOLDERS[Str::lower($feature)] ?? 'misc';
        $uploadPath = "uploads/{$folder}/" . now()->format('Y/m') . ($identifier ? "/{$identifier}" : '');

        $uuid = (string) Str::uuid();
        $extension = strtolower($file->extension() ?: $file->getClientOriginalExtension()); // extension() is guessed from the content
        $path = $file->storeAs($uploadPath, "{$uuid}.{$extension}", 'private');

        return FileUpload::create([
            'filename' => $customFilename ?? $file->getClientOriginalName(),
            'storage_filename' => $uuid,
            'file_type' => $file->getMimeType() ?? $file->getClientMimeType(),
            'file_path' => $path,
            'file_extension' => $extension,
        ]);
    }

    /** Delete the file from disk and its row. */
    public static function delete(?FileUpload $fileUpload): void
    {
        if (!$fileUpload) {
            return;
        }

        Storage::disk('private')->delete($fileUpload->file_path);
        $fileUpload->forceDelete();
    }

    /** Size in bytes, or null if the file is missing on disk. */
    public static function fileSize(?FileUpload $fileUpload): ?int
    {
        if (!$fileUpload || !Storage::disk('private')->exists($fileUpload->file_path)) {
            return null;
        }

        return Storage::disk('private')->size($fileUpload->file_path);
    }

    /** 1258291 -> "1.2 MB" */
    public static function humanReadableSize(?int $bytes): ?string
    {
        if ($bytes === null) {
            return null;
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $index = 0;
        $size = (float) $bytes;

        while ($size >= 1024 && $index < count($units) - 1) {
            $size /= 1024;
            $index++;
        }

        return round($size, $index > 0 ? 1 : 0) . ' ' . $units[$index];
    }
}
```

- The name on disk is a UUID: users can't guess other files' names, and two uploads with the same name never collide.
- `extension()` is guessed from the file **content**, not the name the user typed.

## 4. Uploading a signature

**`app/Http/Requests/SignatureRequest.php`**

```php
<?php

namespace App\Http\Requests;

use App\Http\Resources\GlobalResponseResource;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class SignatureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            // image/png or image/jpeg, max 2 MB
            'signature' => ['required', 'file', 'mimes:png,jpg,jpeg', 'max:2048'],
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json(
            new GlobalResponseResource((object) ['success' => false, 'message' => $validator->errors()->first()]),
            422
        ));
    }
}
```

**`app/Services/v1/modules/ProfileService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Helpers\ActivityLogHelper;
use App\Helpers\FileUploadHelper;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class ProfileService
{
    /** Replace the user's signature: store the new file, then remove the old one. */
    public function uploadSignatureService(User $user, UploadedFile $file)
    {
        $oldSignature = $user->signature;

        DB::transaction(function () use ($user, $file) {
            $upload = FileUploadHelper::fileUpload($file, 'signature', (string) $user->id);
            $user->update(['signature_id' => $upload->id]);
        });

        // After the commit: the old file is only removed once the new one is saved.
        FileUploadHelper::delete($oldSignature);

        $response = (object) [
            'success' => true,
            'message' => 'Signature uploaded successfully.',
        ];

        ActivityLogHelper::log([
            'log_name' => 'profile',
            'event' => 'upload_signature',
            'message' => "User {$user->email} uploaded a new signature.",
            'changes' => ['signature_id' => $user->signature_id],
            'payload' => ['filename' => $file->getClientOriginalName()],
            'response' => $response,
            'subject' => $user,
        ]);

        return $response;
    }
}
```

**`app/Http/Controllers/API/v1/modules/ProfileController.php`**

```php
<?php

namespace App\Http\Controllers\API\v1\modules;

use App\Http\Controllers\Controller;
use App\Http\Requests\SignatureRequest;
use App\Http\Resources\GlobalResponseResource;
use App\Services\v1\modules\ProfileService;

class ProfileController extends Controller
{
    /**
     * Upload my signature.
     *
     * Send multipart/form-data with a "signature" file (PNG or JPG, max 2 MB).
     * Replaces the previous signature.
     *
     * @authenticated
     */
    public function uploadSignature(SignatureRequest $request, ProfileService $service)
    {
        try {
            return new GlobalResponseResource(
                $service->uploadSignatureService($request->user(), $request->file('signature'))
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }
}
```

**`routes/v1/modules/profile.php`**

```php
<?php

use App\Http\Controllers\API\v1\modules\ProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/profile')->controller(ProfileController::class)->middleware('auth:api')->group(function () {
    Route::post('/signature', 'uploadSignature');
});
```


## 5. Serving private files with signed URLs

An `<img src="...">` can't send a Bearer token. A **temporary signed URL** carries a signature and an expiry in its query string; the `signed` middleware rejects it if either is wrong.

**`app/Services/v1/global/FileService.php`**

```php
<?php

namespace App\Services\v1\global;

use App\Models\FileUpload;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileService
{
    /**
     * Stream a private file inline (images, PDFs). Throws ModelNotFoundException (404)
     * when the record or the file on disk is missing.
     */
    public function showFileService(string $storageFilename): StreamedResponse
    {
        $file = FileUpload::where('storage_filename', $storageFilename)->firstOrFail();

        if (!Storage::disk('private')->exists($file->file_path)) {
            throw (new \Illuminate\Database\Eloquent\ModelNotFoundException())->setModel(FileUpload::class);
        }

        return Storage::disk('private')->response($file->file_path, $file->downloadName(), [
            'Content-Type' => $file->file_type,
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }
}
```

**`app/Http/Controllers/API/v1/global/FileController.php`**

```php
<?php

namespace App\Http\Controllers\API\v1\global;

use App\Http\Controllers\Controller;
use App\Services\v1\global\FileService;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class FileController extends Controller
{
    /**
     * Show a signature image.
     *
     * Only reachable through a temporary signed URL (see MeResource::signature_url),
     * so it works in an img tag without a token and expires on its own.
     *
     * @unauthenticated
     */
    public function showSignature(string $storageFilename, FileService $fileService)
    {
        try {
            return $fileService->showFileService($storageFilename);
        } catch (ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'File not found.'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Internal Server Error',
            ], 500);
        }
    }
}
```

**`routes/v1/modules/file.php`**

```php
<?php

use App\Http\Controllers\API\v1\global\FileController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/files')->controller(FileController::class)->group(function () {
    // "signed": the URL must carry a valid, unexpired signature (URL::temporarySignedRoute)
    Route::get('/signatures/{storageFilename}', 'showSignature')
        ->name('files.signature')
        ->whereUuid('storageFilename')
        ->middleware('signed');
});
```

Add the URL to the user payload in `MeResource`:

**`app/Http/Resources/v1/modules/auth/MeResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\URL;

/** The logged-in user as the frontend sees it. */
class MeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'user_role' => $this->userRole?->only(['id', 'name']),
            'is_active' => $this->is_active,
            // Added in foundation 12 (file uploads): a short-lived signed URL for <img src>.
            'signature_url' => $this->signature
                ? URL::temporarySignedRoute('files.signature', now()->addHours(8), [
                    'storageFilename' => $this->signature->storage_filename,
                ])
                : null,
        ];
    }
}
```


::: tip Checklist for any new upload
Validate type **and** size in the request · store with `FileUploadHelper::fileUpload()` · keep the `file_uploads.id` on your record · serve through a controller or a signed URL · delete the old file when replacing.
:::

## Check it works

```bash
php artisan migrate
curl -X POST http://127.0.0.1:8000/api/v1/profile/signature \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  -F "signature=@signature.png"
```

Then `GET /api/v1/auth/me`: open `signature_url` in a browser and the image shows. Change one character of the URL and you get **403 Invalid signature**.

Next: [13 · CORS & rate limits](/foundations/13-cors-and-rate-limits)
