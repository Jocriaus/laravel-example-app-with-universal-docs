# A Blade (full-stack) module

The API is for a separate frontend. Sometimes you also want **server-rendered pages**, for example a small admin screen. This guide builds Campus pages with Blade that reuse **the same `CampusService`** as the API from [Creating a module](/guides/creating-a-module). Only the HTTP layer is new.

```
routes/web.php ─► CampusPageController ─┐
                                          ├─► CampusService ─► Campus ─► MySQL
routes/v1/modules/campus.php ─► CampusController (JSON) ─┘
```

**Before you start:** finish [Creating a module](/guides/creating-a-module) (model, request, service) and run `npm install`.

## What's different on the web side

| | API | Blade pages |
|---|---|---|
| Routes | `routes/v1/modules/*.php` under `/api` | `routes/web.php` |
| Auth | `auth:api` (JWT) | `auth:web` (session cookie) |
| Output | JSON resources | views |
| Validation failure | 422 JSON | redirect back with errors + old input |
| Success | JSON envelope | redirect + flash message |
| CSRF | origin check on cookie endpoints | `@csrf` in every form |

## 1. Session login

Blade pages log in with the `web` guard. Reuse `AuthService::authenticate()` so the rules (active accounts only, same error for every failure) stay in one place.

**`app/Http/Controllers/Web/LoginController.php`**

```php
<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\Auth\InvalidCredentialsException;
use App\Http\Controllers\Controller;
use App\Services\v1\modules\AuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginController extends Controller
{
    public function show()
    {
        return view('auth.login');
    }

    public function store(Request $request, AuthService $authService)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        try {
            $user = $authService->authenticate($credentials['email'], $credentials['password']);
        } catch (InvalidCredentialsException $e) {
            return back()->withErrors(['email' => $e->getMessage()])->onlyInput('email');
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();   // new session id: prevents session fixation

        return redirect()->intended(route('campuses.index'));
    }

    public function destroy(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
```

## 2. The page controller

**`app/Http/Controllers/Web/CampusPageController.php`**

```php
<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\InvalidException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CampusRequest;
use App\Models\Campus;
use App\Services\v1\modules\CampusService;
use Illuminate\Http\Request;

class CampusPageController extends Controller
{
    public function index(Request $request, CampusService $service)
    {
        $campuses = $service->viewCampusesService($request)->withQueryString();

        return view('campuses.index', ['campuses' => $campuses, 'search' => $request->input('search')]);
    }

    public function create()
    {
        return view('campuses.form', ['campus' => new Campus(['is_active' => true])]);
    }

    public function store(CampusRequest $request, CampusService $service)
    {
        $result = $service->createCampusService($request->validated());

        return redirect()->route('campuses.index')->with('status', $result->message);
    }

    public function edit($id)
    {
        return view('campuses.form', ['campus' => Campus::findOrFail($id)]);
    }

    public function update(CampusRequest $request, $id, CampusService $service)
    {
        $result = $service->updateCampusService(array_merge($request->validated(), ['id' => $id]));

        return redirect()->route('campuses.index')->with('status', $result->message);
    }

    public function destroy($id, CampusService $service)
    {
        try {
            $result = $service->deleteCampusService($id);
        } catch (InvalidException $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()->route('campuses.index')->with('status', $result->message);
    }
}
```

::: tip The same FormRequest works for both
`CampusRequest` answers a JSON 422 for API calls through its `failedValidation()` override. For web forms, only override it when the request expects JSON, so web forms keep Laravel's normal "redirect back with errors":

```php
protected function failedValidation(Validator $validator)
{
    if (!$this->expectsJson()) {
        parent::failedValidation($validator);   // redirect back with errors + old input
    }

    throw new HttpResponseException(response()->json(
        new GlobalResponseResource((object) ['success' => false, 'message' => $validator->errors()->first()]),
        422
    ));
}
```
:::

## 3. Routes

**`routes/web.php`**

```php
<?php

use App\Constants\ModuleActions;
use App\Constants\SubModules;
use App\Http\Controllers\Web\CampusPageController;
use App\Http\Controllers\Web\LoginController;
use App\Http\Middleware\ModulePermissionMiddleware as Permission;
use Illuminate\Support\Facades\Route;

Route::middleware('guest:web')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:10,1');
});

Route::middleware('auth:web')->group(function () {
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

    $can = fn (string $action) => Permission::using(SubModules::CAMPUS_SETUP, $action);

    Route::prefix('campuses')->name('campuses.')->controller(CampusPageController::class)->group(function () use ($can) {
        Route::get('/', 'index')->name('index')->middleware($can(ModuleActions::VIEW));
        Route::get('/create', 'create')->name('create')->middleware($can(ModuleActions::CREATE));
        Route::post('/', 'store')->name('store')->middleware($can(ModuleActions::CREATE));
        Route::get('/{id}/edit', 'edit')->name('edit')->whereNumber('id')->middleware($can(ModuleActions::UPDATE));
        Route::patch('/{id}', 'update')->name('update')->whereNumber('id')->middleware($can(ModuleActions::UPDATE));
        Route::delete('/{id}', 'destroy')->name('destroy')->whereNumber('id')->middleware($can(ModuleActions::DELETE));
    });
});
```

The same `module.permission` middleware protects the pages. Missing permissions show Laravel's normal **403** page.

::: warning Default guard
`config/auth.php` sets the default guard to `api`. On web routes, always name the guard (`auth:web`, `guest:web`, `Auth::guard('web')`). The `auth:web` middleware also makes `web` the default for the rest of that request, so `$request->user()` and the activity log's causer are correct.
:::

## 4. Views

**`resources/views/components/layouts/app.blade.php`**

```blade
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-gray-50 text-gray-900">
    @auth('web')
        <nav class="flex items-center justify-between border-b bg-white px-6 py-3">
            <a href="{{ route('campuses.index') }}" class="font-semibold">{{ config('app.name') }}</a>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <span class="mr-3 text-sm">{{ auth('web')->user()->full_name }}</span>
                <button class="text-sm underline">Log out</button>
            </form>
        </nav>
    @endauth

    <main class="mx-auto max-w-4xl p-6">
        @if (session('status'))
            <div class="mb-4 rounded bg-green-100 p-3 text-green-800">{{ session('status') }}</div>
        @endif
        @if (session('error'))
            <div class="mb-4 rounded bg-red-100 p-3 text-red-800">{{ session('error') }}</div>
        @endif

        {{ $slot }}
    </main>
</body>
</html>
```

**`resources/views/auth/login.blade.php`**

```blade
<x-layouts.app title="Log in">
    <form method="POST" action="{{ url('/login') }}" class="mx-auto mt-16 max-w-sm space-y-4 rounded bg-white p-6 shadow">
        @csrf
        <h1 class="text-xl font-semibold">Log in</h1>

        <div>
            <label for="email" class="block text-sm">Email</label>
            <input id="email" name="email" type="email" value="{{ old('email') }}" required autofocus
                   class="w-full rounded border p-2">
            @error('email') <p class="text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="password" class="block text-sm">Password</label>
            <input id="password" name="password" type="password" required class="w-full rounded border p-2">
        </div>

        <button class="w-full rounded bg-gray-900 p-2 text-white">Log in</button>
    </form>
</x-layouts.app>
```

**`resources/views/campuses/index.blade.php`**

```blade
<x-layouts.app title="Campuses">
    <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-semibold">Campuses</h1>
        @if (auth('web')->user()->hasModulePermission(\App\Constants\SubModules::CAMPUS_SETUP, \App\Constants\ModuleActions::CREATE))
            <a href="{{ route('campuses.create') }}" class="rounded bg-gray-900 px-3 py-2 text-white">New campus</a>
        @endif
    </div>

    <form method="GET" class="mb-4">
        <input name="search" value="{{ $search }}" placeholder="Search code or name" class="w-full rounded border p-2">
    </form>

    <table class="w-full bg-white text-left">
        <thead>
            <tr class="border-b"><th class="p-2">Code</th><th class="p-2">Name</th><th class="p-2">Status</th><th></th></tr>
        </thead>
        <tbody>
            @forelse ($campuses as $campus)
                <tr class="border-b">
                    <td class="p-2">{{ $campus->code }}</td>
                    <td class="p-2">{{ $campus->name }}</td>
                    <td class="p-2">{{ $campus->is_active ? 'Active' : 'Inactive' }}</td>
                    <td class="p-2 text-right">
                        <a href="{{ route('campuses.edit', $campus->id) }}" class="underline">Edit</a>
                        <form method="POST" action="{{ route('campuses.destroy', $campus->id) }}" class="inline"
                              onsubmit="return confirm(@js('Delete '.$campus->name.'?'))">
                            @csrf
                            @method('DELETE')
                            <button class="ml-2 text-red-600 underline">Delete</button>
                        </form>
                    </td>
                </tr>
            @empty
                <tr><td colspan="4" class="p-4 text-center text-gray-500">No campuses found.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="mt-4">{{ $campuses->links() }}</div>
</x-layouts.app>
```

**`resources/views/campuses/form.blade.php`** (create and edit share one form)

```blade
@php($editing = $campus->exists)

<x-layouts.app :title="$editing ? 'Edit campus' : 'New campus'">
    <h1 class="mb-4 text-xl font-semibold">{{ $editing ? "Edit {$campus->name}" : 'New campus' }}</h1>

    <form method="POST"
          action="{{ $editing ? route('campuses.update', $campus->id) : route('campuses.store') }}"
          class="space-y-4 rounded bg-white p-6 shadow">
        @csrf
        @if ($editing) @method('PATCH') @endif

        @foreach (['code' => 'Code', 'name' => 'Name', 'address' => 'Address'] as $field => $label)
            <div>
                <label for="{{ $field }}" class="block text-sm">{{ $label }}</label>
                <input id="{{ $field }}" name="{{ $field }}" value="{{ old($field, $campus->$field) }}"
                       class="w-full rounded border p-2">
                @error($field) <p class="text-sm text-red-600">{{ $message }}</p> @enderror
            </div>
        @endforeach

        <input type="hidden" name="is_active" value="0">
        <label class="flex items-center gap-2">
            <input type="checkbox" name="is_active" value="1" @checked(old('is_active', $campus->is_active))>
            Active
        </label>

        <div class="flex gap-2">
            <button class="rounded bg-gray-900 px-4 py-2 text-white">Save</button>
            <a href="{{ route('campuses.index') }}" class="px-4 py-2 underline">Cancel</a>
        </div>
    </form>
</x-layouts.app>
```

::: v-pre
`@js(...)` turns a PHP value into a safe JavaScript literal. Never print user data into JavaScript with `{{ }}`: HTML escaping doesn't protect a JavaScript string.
:::

The hidden `is_active=0` field before the checkbox makes an **unchecked** box send `0` instead of nothing, which the `boolean` rule accepts.

## Check it works

```bash
npm run dev          # terminal 1: Vite
php artisan serve    # terminal 2
```

1. Open `http://127.0.0.1:8000/campuses`: you are redirected to `/login`.
2. Log in as `admin@email.com` / `admin` and create, edit, search and delete campuses. Every change also appears in the activity log.
3. Log in as a user whose group has only `Campus Setup · View`: the **New campus** button is hidden, and opening `/campuses/create` directly shows **403**.
4. Submit the form with an empty name: the page comes back with the error and your other input kept.
