# RESTful APIs

An **API** (Application Programming Interface) is a way for programs to talk to each other. A **web API** does it over HTTP, usually with JSON. **REST** is a set of conventions that makes web APIs predictable.

## The core idea: resources

Think in **nouns** (resources), not actions. The URL names the resource; the **HTTP method** says what to do with it.

| Action | Method & URL | Success status |
|---|---|---|
| List campuses | `GET /api/v1/campuses` | 200 |
| Read one campus | `GET /api/v1/campuses/5` | 200 (404 if missing) |
| Create a campus | `POST /api/v1/campuses` | 201 (or 200) |
| Change some fields | `PATCH /api/v1/campuses/5` | 200 |
| Replace completely | `PUT /api/v1/campuses/5` | 200 |
| Delete | `DELETE /api/v1/campuses/5` | 200 or 204 |

Avoid verbs in URLs: not `POST /createCampus` or `GET /getCampuses`.

### Nested resources and actions

```
GET  /api/v1/user-groups/4/members        members *of* group 4
PUT  /api/v1/user-groups/4/permissions    replace the permission set of group 4
POST /api/v1/applications/12/approve      an action that isn't plain CRUD
GET  /api/v1/user-groups/stats            a computed summary
```

When an operation really is an action (approve, publish, logout), a `POST` to a sub-path with a verb is the accepted exception.

## Principles

| Principle | Meaning | In practice |
|---|---|---|
| **Stateless** | every request carries everything needed (e.g. the token) | no server memory of "the previous request" |
| **Uniform interface** | same patterns everywhere | same URL style, same envelope, same status codes |
| **Client–server** | frontend and backend evolve separately | the API doesn't care whether the client is Vue, mobile or a script |
| **Cacheable** | responses say whether they may be cached | `Cache-Control` headers |
| **Layered** | proxies / load balancers can sit in between | `TrustProxies`, rate limits |

## Designing good endpoints

### Naming

- Plural, lowercase, kebab-case nouns: `/user-groups`, `/campuses`.
- IDs in the path, options in the query string: `/campuses/5`, `/campuses?search=main&page=2`.
- JSON keys in `snake_case`: `access_expires_in`, `is_active`.

### Versioning

Prefix URLs with a version: `/api/v1/...`. When you must break the contract (rename a field, change a type), publish `/api/v2/...` and keep `v1` working until clients move.

**Breaking changes:** removing or renaming a field, changing a type, making an optional field required, changing a status code. **Non-breaking:** adding an optional field or a new endpoint.

### Pagination, search, filter, sort

Lists are always paginated. These docs use:

```
GET /api/v1/campuses?page=2&per_page=10&search=main&active=1&so=n,desc
```

| Param | Meaning |
|---|---|
| `page`, `per_page` | which slice |
| `search` | free-text search |
| filter keys (`active`, ...) | exact-match filters |
| `so=key,direction` | sort |

### One response envelope

```json
{ "success": true, "message": "Campuses fetched successfully", "data": [ ... ], "meta": { "total": 42 } }
{ "success": false, "message": "The name field is required." }
```

The client can always read `success` and `message`, whatever the endpoint.

### Status codes carry meaning

| Situation | Status |
|---|---|
| Validation failed | 422 + first error in `message` |
| Business rule broken ("group still has members") | 400 |
| Not logged in / token expired | 401 |
| Logged in but not allowed | 403 |
| Not found | 404 |
| Conflict / race | 409 |
| Too many requests | 429 |
| Bug | 500, never with a stack trace in production |

Never answer `200` with `"success": false` for an error the client must react to: status codes are what HTTP clients, proxies and monitoring understand.

### Authentication

APIs send credentials **on every request**, usually `Authorization: Bearer <access token>`. Tokens are short-lived; a refresh mechanism gets a new one. Details: [Authentication](/architecture/authentication).

### Documentation

An API nobody can discover is useless. These docs generate an **OpenAPI** description automatically from the code with Scramble ([API docs](/foundations/11-api-docs)), browsable at `/docs/api`.

## Calling an API

```bash
curl -X POST http://localhost:8000/api/v1/campuses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"code":"MAIN","name":"Main Campus","is_active":true}'
```

The same request as a VS Code REST Client `.http` file:

```http
POST http://localhost:8000/api/v1/campuses
Authorization: Bearer {{token}}
Accept: application/json
Content-Type: application/json

{ "code": "MAIN", "name": "Main Campus", "is_active": true }
```

::: tip Always send `Accept: application/json`
Without it, Laravel treats the call as a browser request: validation errors become redirects and errors become HTML pages.
:::

Next: [Full-stack architectures](/fundamentals/full-stack)
