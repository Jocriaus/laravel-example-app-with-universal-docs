# API reference (Scramble)

Endpoint documentation is **generated from the code** by [Scramble](https://scramble.dedoc.co). There is nothing to write by hand, and it cannot drift from the real API.

| URL | What |
|---|---|
| `/docs/api` | Interactive reference (Stoplight Elements) with "Try it" |
| `/docs/api.json` | OpenAPI 3.1 spec |

Everything under `/api` is included (`config/scramble.php` → `api_path`). Bearer JWT auth is declared in `ScrambleServiceProvider`, so "Try it" accepts an access token.

::: warning Access in production
The docs routes use Scramble's `RestrictedDocsAccess` middleware: open in the `local` environment and closed elsewhere unless you define the `viewApiDocs` gate.
:::

## What Scramble reads

| Source | Becomes |
|---|---|
| Route method + URI | endpoint |
| Controller docblock, first line | endpoint title |
| Controller docblock, paragraph | endpoint description (the `Query params:` list included) |
| `@authenticated` / `@unauthenticated` | lock icon / public |
| FormRequest `rules()` | request body schema with types and required flags |
| `// @example value` above a rule | example value |
| Resource `toArray()` | response schema |

## Writing endpoints that document well

```php
/**
 * Create a campus.
 *
 * Registers a new campus. The code must be unique among active campuses.
 *
 * @authenticated
 */
public function createCampus(CampusRequest $request, CampusService $service) { ... }
```

```php
public function rules(): array
{
    return [
        // @example MAIN
        'code' => ['required', 'string', 'max:20'],
        // @example Main Campus
        'name' => ['required', 'string', 'max:150'],
    ];
}
```

- Use a **FormRequest** instead of `$request->validate([...])` in the controller when you want the body documented well.
- Keep list parameters in the docblock (`Query params:` list).

## Export the spec

```bash
php artisan scramble:export      # writes api.json at the project root
```

Import `api.json` into Postman, Insomnia, or a frontend client generator.
