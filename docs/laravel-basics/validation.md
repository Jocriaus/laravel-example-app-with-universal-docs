# Validation & form requests

Never use input you haven't validated.

## Inline validation

```php
$data = $request->validate([
    'code' => 'required|string|max:20|unique:campuses,code',
    'name' => ['required', 'string', 'max:150'],
    'is_active' => 'boolean',
]);
```

On failure Laravel throws a `ValidationException`: a JSON `422` for API requests (with `Accept: application/json`), or a redirect back with errors for web forms.

## Form requests (preferred)

Move the rules into their own class so controllers stay thin and the API docs can read them:

```bash
php artisan make:request CampusRequest
```

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CampusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;   // permission checks live in route middleware
    }

    public function rules(): array
    {
        // POST: everything required; PATCH: only what is sent
        $required = $this->isMethod('patch') ? 'sometimes' : 'required';

        return [
            'code' => [$required, 'string', 'max:20',
                Rule::unique('campuses', 'code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'name' => [$required, 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => [$required, 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['code.unique' => 'This campus code is already in use.'];
    }
}
```

Type-hint it in the controller; validation runs **before** your method:

```php
public function store(CampusRequest $request) {
    $data = $request->validated();   // only the keys in rules()
}
```

## Rules you'll use most

| Rule | Meaning |
|---|---|
| `required`, `nullable`, `sometimes` | must be present / may be null / validate only if present |
| `string`, `integer`, `numeric`, `boolean`, `array` | type |
| `max:150`, `min:8`, `between:1,5` | size (characters for strings, value for numbers, KB for files) |
| `email`, `url`, `uuid`, `date`, `in:a,b,c` | format |
| `unique:table,column`, `exists:table,column` | database checks |
| `confirmed` | `password` must match `password_confirmation` |
| `image`, `mimes:pdf,jpg`, `file` | uploads |
| `array` + `'items.*.id' => 'integer'` | every element of an array |
| `distinct`, `present` | no duplicates / key must exist even if empty |

## Normalising input before validation

```php
protected function prepareForValidation(): void
{
    $this->merge(['code' => strtoupper((string) $this->input('code'))]);
}
```

## Custom error format

The default 422 body is `{ "message": "...", "errors": { "field": ["..."] } }`. These docs use a smaller envelope (`{ "success": false, "message": "first error" }`); see [Responses & errors](/foundations/03-responses-and-errors) for the `failedValidation()` override.

Next: [Eloquent: models & migrations](/laravel-basics/eloquent)
