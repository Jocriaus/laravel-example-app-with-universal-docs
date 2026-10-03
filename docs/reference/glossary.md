# Glossary

| Term | Meaning |
|---|---|
| **Access token** | Short-lived JWT sent as `Authorization: Bearer ...` on every API call |
| **API** | Application Programming Interface: a way for programs to talk; here, HTTP + JSON |
| **Artisan** | Laravel's command-line tool (`php artisan ...`) |
| **Blade** | Laravel's HTML template engine (`.blade.php`) |
| **Catalogue** | The list of actions each sub-module offers (`system_sub_modules_actions`) |
| **Composer** | PHP's package manager (`composer.json`, `vendor/`) |
| **Controller** | Class that turns an HTTP request into a service call and the result into a response |
| **CORS** | Browser rule that blocks reading responses from another origin unless the server allows it |
| **CSRF** | An attack where another site makes your browser send a request with your cookies |
| **DTO / value object** | Small class that only carries data (`ClientInfo`, `IssuedTokens`) |
| **Eager loading** | Loading relations up front with `with()` to avoid N + 1 queries |
| **Eloquent** | Laravel's ORM: models map to tables |
| **Envelope** | The standard response shape `{ success, message, data }` |
| **Factory** | Class that makes fake model data for tests and seeding |
| **Family** | All refresh-token rows of one login (one device), sharing a `family_id` |
| **FormRequest** | Class holding the validation rules for one endpoint |
| **Guard** | Laravel's "who is the user?" mechanism: `web` (session) or `api` (JWT) |
| **HMAC** | A keyed hash; used to store refresh tokens with a secret pepper |
| **httpOnly cookie** | A cookie JavaScript cannot read |
| **Idempotent** | Repeating the request has the same effect as sending it once |
| **JWT** | JSON Web Token: a signed JSON document (`header.payload.signature`) |
| **Middleware** | Code that runs before/after a controller: auth, permissions, throttling, logging |
| **Migration** | A versioned schema change written in PHP |
| **Model** | Eloquent class for one table |
| **Module** | One feature: route file + request + controller + service + resource (+ model) |
| **N + 1 problem** | One query for a list plus one per row for a relation |
| **ORM** | Object-relational mapper: work with objects instead of SQL |
| **Origin** | Scheme + host + port, e.g. `http://localhost:5173` |
| **Pepper** | Server-side secret mixed into a hash, kept out of the database |
| **Pivot table** | Table joining two others in a many-to-many relation |
| **RBAC** | Role-based access control: permissions granted to groups, users in groups |
| **Refresh token** | Long-lived random token that gets new access tokens; httpOnly cookie |
| **Resource** | Class that shapes a model into JSON |
| **REST** | Conventions for HTTP APIs: resources in URLs, meaning in methods and status codes |
| **Rotation** | Every refresh replaces the refresh token; the old one becomes invalid |
| **Seeder** | Class that inserts initial data |
| **Service** | Class holding a feature's business logic, queries, transactions and logging |
| **Service container** | Laravel's object builder that injects dependencies |
| **Signed URL** | URL with a signature and expiry that the server can verify |
| **Soft delete** | Marking a row deleted (`deleted_at`) instead of removing it |
| **SPA** | Single-page application: a JavaScript frontend that calls an API |
| **Sub-module** | One screen inside a module (Campus Setup, Access Rights); permissions are per sub-module |
| **Transaction** | A group of database writes that succeed or fail together |
| **Vite** | The frontend build tool Laravel uses for CSS/JS |
