# Full-stack architectures

**Full-stack** development means building both halves: the frontend the user sees and the backend that stores and protects the data. The main decision is **where the HTML is produced**.

## 1. Server-rendered pages (MPA) with Blade

```
Browser ── GET /campuses ──► Laravel ─► Blade template ─► full HTML page
Browser ── POST /campuses (form) ──► Laravel ─► redirect ─► GET /campuses
```

- Laravel renders HTML with **Blade** templates. Every click loads a new page.
- Login uses a **session cookie**; forms are protected with a **CSRF token**.
- Simplest to build and to secure, and good for SEO.
- Less interactive, unless you add some JavaScript (Alpine.js) or Livewire.

**Use it for:** admin panels, internal tools, content sites, small teams.

## 2. Single-page app (SPA) + JSON API

```
Browser loads the SPA once (Vue / React, built with Vite)
SPA ── fetch GET /api/v1/campuses (Bearer token) ──► Laravel API ──► JSON
SPA renders the JSON in the browser
```

- The backend is a pure **API**: no HTML, only JSON.
- The frontend is a separate JavaScript app, often in its own repository and domain.
- The same API can serve a mobile app or other systems.
- More moving parts: CORS, token handling, two deployments.

**Use it for:** highly interactive apps, several clients (web + mobile), separate frontend and backend teams.

**These docs build this kind of backend.** The API is the product, and [Blade](/laravel-basics/blade) is covered for the admin or server-rendered parts.

## 3. Hybrid: Inertia.js or Livewire

- **Inertia** lets you write Vue/React pages but keep Laravel routing, controllers and session auth; no separate API needed.
- **Livewire** makes Blade components interactive with PHP instead of JavaScript.

Laravel's starter kits (`laravel new` → React, Vue or Livewire) set these up for you. They are a good choice for a full-stack app that does **not** need a public API.

## Comparison

| | Blade (MPA) | SPA + API | Inertia / Livewire |
|---|---|---|---|
| HTML rendered by | server | browser | browser (Inertia) / server (Livewire) |
| Auth | session cookie | tokens (+ refresh cookie) | session cookie |
| CSRF protection | `@csrf` token | origin check on cookie endpoints | built in |
| CORS needed | no | yes, if on another domain | no |
| Serves mobile apps too | no | yes | no |
| Complexity | low | high | medium |

## How the layers stay reusable

Whatever renders the HTML, keep business logic in **services**. Then a Blade controller and an API controller call the same code:

```
Blade:  web.php  → CampusPageController    ┐
                                            ├─► CampusService ─► Campus model ─► MySQL
API:    api.php  → CampusController (JSON) ┘
```

[A Blade module](/guides/blade-module) builds server-rendered pages on top of the same `CampusService` the API uses.

## Where things run in production

```
                ┌──────────────────────── your server(s) ─────────────────────────┐
User ─HTTPS─► Nginx ─┬─► /api/*  → PHP-FPM → Laravel ─► MySQL                      │
                     └─► /*      → static SPA files (index.html, JS, CSS)          │
                └──────────────────────────────────────────────────────────────────┘
```

Putting the SPA and the API under the **same domain** (e.g. `app.school.edu` and `app.school.edu/api`) avoids CORS entirely and lets cookies use `SameSite=Strict`.

Next: [Security basics](/fundamentals/security-basics)
