# Blade templates

**Blade** is Laravel's template engine for server-rendered HTML. Templates live in `resources/views/` with the extension `.blade.php`, and are compiled to plain PHP and cached.

```php
// routes/web.php
Route::get('/hello', fn () => view('hello', ['name' => 'Juan']));
```

```blade
{{-- resources/views/hello.blade.php --}}
<h1>Hello, {{ $name }}!</h1>
```

`view('hello')` loads `resources/views/hello.blade.php`; `view('campuses.index')` loads `resources/views/campuses/index.blade.php`.

## Printing data

::: v-pre
| Syntax | Does |
|---|---|
| `{{ $value }}` | prints **escaped** (safe: `<script>` becomes text) |
| `{!! $html !!}` | prints **raw** HTML. Only for HTML you generated yourself |
| `{{ $user->name ?? 'Guest' }}` | any PHP expression |
| `@{{ vueVariable }}` | prints the braces literally (for Vue/Alpine) |
| `{{-- comment --}}` | comment, not sent to the browser |
:::

## Control structures

```blade
@if ($campuses->isEmpty())
    <p>No campuses yet.</p>
@elseif ($campuses->count() === 1)
    <p>One campus.</p>
@else
    <p>{{ $campuses->count() }} campuses.</p>
@endif

@foreach ($campuses as $campus)
    <li>{{ $loop->iteration }}. {{ $campus->name }}</li>
@endforeach

@forelse ($campuses as $campus)
    <li>{{ $campus->name }}</li>
@empty
    <li>Nothing found.</li>
@endforelse

@auth
    <a href="{{ route('logout') }}">Log out</a>
@endauth

@guest
    <a href="{{ route('login') }}">Log in</a>
@endguest
```

`$loop` inside loops gives `index`, `iteration`, `first`, `last`, `count`.

## Layouts with components

Create a layout component once and wrap every page in it.

```blade
{{-- resources/views/components/layouts/app.blade.php --}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-50 text-gray-900">
    <nav class="p-4 border-b">
        <a href="{{ route('campuses.index') }}">Campuses</a>
    </nav>

    <main class="p-6">
        @if (session('status'))
            <div class="mb-4 rounded bg-green-100 p-3">{{ session('status') }}</div>
        @endif

        {{ $slot }}
    </main>
</body>
</html>
```

```blade
{{-- resources/views/campuses/index.blade.php --}}
<x-layouts.app title="Campuses">
    <h1 class="text-xl font-semibold">Campuses</h1>
    ...
</x-layouts.app>
```

::: v-pre
- `<x-layouts.app>` renders `components/layouts/app.blade.php`.
- The page content is placed where the layout prints `{{ $slot }}`.
- Attributes such as `title="..."` become variables (`$title`).
:::

::: details The older way: @extends / @section
```blade
{{-- layouts/app.blade.php --}}
<body>@yield('content')</body>

{{-- page --}}
@extends('layouts.app')
@section('content')
    <h1>Campuses</h1>
@endsection
```
Both work. Components are the modern default.
:::

## Reusable components

```blade
{{-- resources/views/components/input.blade.php --}}
@props(['name', 'label', 'type' => 'text', 'value' => null])

<div class="mb-4">
    <label for="{{ $name }}" class="block text-sm">{{ $label }}</label>
    <input id="{{ $name }}" name="{{ $name }}" type="{{ $type }}"
           value="{{ old($name, $value) }}"
           {{ $attributes->merge(['class' => 'border rounded p-2 w-full']) }}>
    @error($name)
        <p class="text-sm text-red-600">{{ $message }}</p>
    @enderror
</div>
```

```blade
<x-input name="code" label="Code" :value="$campus->code" maxlength="20" />
```

A `:` before an attribute passes a PHP expression instead of a string.

## Forms

```blade
<form method="POST" action="{{ route('campuses.update', $campus) }}">
    @csrf
    @method('PATCH')

    <x-input name="name" label="Name" :value="$campus->name" />

    <label>
        <input type="checkbox" name="is_active" value="1" @checked(old('is_active', $campus->is_active))>
        Active
    </label>

    <button type="submit">Save</button>
</form>
```

| Piece | Why |
|---|---|
| `@csrf` | hidden token that proves the form came from your site. Without it: **419 Page Expired** |
| `@method('PATCH')` | HTML forms only send GET/POST; this hidden `_method` field lets Laravel route it as PATCH/PUT/DELETE |
| `old('name', $default)` | refills the field after a validation error |
| `@error('name') ... @enderror` | shows that field's first validation message as `$message` |
| `@checked`, `@selected`, `@disabled` | print the attribute when the condition is true |

## The web request cycle (POST → redirect → GET)

```php
// routes/web.php
Route::post('/campuses', function (CampusRequest $request, CampusService $service) {
    $result = $service->createCampusService($request->validated());

    return redirect()->route('campuses.index')->with('status', $result->message);
});
```

1. The form POSTs.
2. On **validation failure** Laravel redirects back automatically with the errors and old input; the page shows them with `@error` and `old()`.
3. On **success** you redirect (never render directly after a POST, or a page refresh resubmits the form) and "flash" a message into the session for one request.
4. The next page shows `session('status')`.

## Web authentication in one minute

Blade pages use **session** authentication (the `web` guard), not the API's JWT:

```php
if (Auth::attempt($request->only('email', 'password'))) {
    $request->session()->regenerate();       // prevent session fixation
    return redirect()->intended('/campuses');
}
return back()->withErrors(['email' => 'Invalid email or password.'])->onlyInput('email');
```

Protect pages with `->middleware('auth')`. For a complete login/registration UI, the **starter kits** (`laravel new` → Livewire/Vue/React) generate everything.

## Assets with Vite

`@vite([...])` in the layout loads CSS/JS. During development run `npm run dev` (hot reload); for production `npm run build`.

## Check it works

1. Create the layout and `resources/views/hello.blade.php` above.
2. Add `Route::get('/hello', fn () => view('hello', ['name' => 'Juan']));` to `routes/web.php`.
3. Run `npm install && npm run dev` in one terminal, `php artisan serve` in another.
4. Open `http://127.0.0.1:8000/hello`.

The full server-rendered CRUD built on the same service as the API: [A Blade module](/guides/blade-module).

Next: [Testing with Pest](/laravel-basics/testing)
