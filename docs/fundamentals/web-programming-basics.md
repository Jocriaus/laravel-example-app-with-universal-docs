# Web programming basics

A web application is split into two halves that talk over HTTP.

| | Frontend (client side) | Backend (server side) |
|---|---|---|
| Runs on | the user's browser | your server |
| Languages | HTML, CSS, JavaScript | PHP (Laravel), plus SQL for the database |
| Can be trusted? | **No.** The user can change anything | Yes, you control it |
| Responsible for | showing data, collecting input, UX | rules, validation, security, storing data |

::: warning The golden rule
**Never trust the client.** Validation in JavaScript is for convenience; the backend must validate everything again. A user can send any request with `curl`, whatever your form allows.
:::

## The three frontend languages

### HTML: structure

HTML describes *what* is on the page with tags such as `<h1>`, `<p>`, `<a>`, `<form>` and `<input>`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Campuses</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body>
  <h1>Campuses</h1>

  <form method="POST" action="/campuses">
    <label for="name">Name</label>
    <input id="name" name="name" required>
    <button type="submit">Save</button>
  </form>

  <script src="/js/app.js"></script>
</body>
</html>
```

A `<form>` sends its fields to the `action` URL with the given `method`; each `<input name="...">` becomes a request parameter. HTML forms only support `GET` and `POST` (Laravel adds `PUT`/`PATCH`/`DELETE` with a hidden `_method` field; see [Blade](/laravel-basics/blade)).

### CSS: presentation

CSS describes *how* things look: colors, spacing, layout.

```css
h1 { font-size: 1.5rem; color: #1f2937; }
form { display: flex; gap: .5rem; }
```

Laravel ships with **Vite** and **Tailwind CSS**, which lets you style with utility classes (`class="flex gap-2 text-xl"`).

### JavaScript: behavior

JavaScript runs in the browser and changes the page without reloading it. It is how single-page apps talk to an API:

```js
const response = await fetch('/api/v1/campuses', {
  headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
})
const body = await response.json()
console.log(body.data) // array of campuses
```

## The backend: PHP

PHP runs on the server, once per request. It reads the request, talks to the database, and returns a response.

```php
<?php
// the smallest possible "API", without any framework
header('Content-Type: application/json');

$pdo = new PDO('mysql:host=127.0.0.1;dbname=school', 'root', '');
$rows = $pdo->query('SELECT id, name FROM campuses')->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['data' => $rows]);
```

That works, but a real application also needs routing, validation, authentication, security headers, database migrations, error handling and tests. A **framework** like Laravel gives you all of that, so you only write the parts that are specific to your application.

### PHP essentials you will see everywhere

```php
$name = 'Main';                          // variables start with $
$campus = ['code' => 'MAIN', 'name' => $name];   // associative array
echo "Campus: {$campus['name']}";        // string interpolation

function greet(string $who): string {     // typed function
    return "Hello {$who}";
}

class CampusService {                     // class
    public function __construct(private CampusRepository $repo) {}  // constructor promotion
    public function find(int $id): ?Campus { return Campus::find($id); }  // ?Campus = Campus or null
}

$total = $items ?? [];                    // null coalescing: $items if set and not null, else []
$city = $campus?->address?->city;         // nullsafe: stops at the first null
$fn = fn ($x) => $x * 2;                  // arrow function
```

Namespaces (`namespace App\Models;`) organise classes into folders, and `use App\Models\Campus;` imports them. **Composer** loads classes automatically from their namespace and file path (PSR-4), which is why a class must live in the file that matches its name.

## Data formats: JSON

APIs exchange data as **JSON** (JavaScript Object Notation):

```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "MAIN", "name": "Main Campus", "is_active": true }
  ]
}
```

- Objects `{}` hold key/value pairs; keys are always double-quoted strings.
- Arrays `[]` hold ordered values.
- Values: strings, numbers, `true`/`false`, `null`, objects, arrays.

In PHP, `json_encode()` turns arrays into JSON and `json_decode($json, true)` turns JSON into arrays. Laravel does this for you when you return an array or a resource.

## Where the database fits

The backend stores data in a **database** (MySQL in these docs) using **SQL**. Laravel's Eloquent lets you use PHP objects instead of writing SQL by hand. See [Databases & SQL](/fundamentals/databases-and-sql).

```
Browser (HTML/CSS/JS) ──HTTP──► Laravel (PHP) ──SQL──► MySQL
```

Next: [The web development workflow](/fundamentals/web-development-workflow)
