# How the web works

Everything in these docs sits on one idea: **a client sends a request, a server sends back a response.**

```
 Browser / mobile app / Postman                 Your Laravel app
 ─────────────────────────────                  ─────────────────
          CLIENT          ── HTTP request ──►       SERVER
                          ◄─ HTTP response ──
```

## The pieces

| Piece | What it is | Example |
|---|---|---|
| **Client** | The program that asks | Chrome, a Vue app, a phone app, `curl` |
| **Server** | The program that answers | PHP + Laravel behind Apache/Nginx |
| **URL** | The address of a resource | `https://api.school.edu/api/v1/campuses?page=2` |
| **DNS** | The phonebook that turns a name into an IP address | `api.school.edu` → `203.0.113.10` |
| **HTTP** | The language client and server speak | `GET /api/v1/campuses HTTP/1.1` |
| **HTTPS** | HTTP inside an encrypted TLS tunnel | the padlock in the address bar |

### Anatomy of a URL

```
https://api.school.edu:443/api/v1/campuses?page=2&search=main#top
└─┬─┘   └─────┬──────┘ └┬┘ └──────┬───────┘ └────────┬───────┘ └┬┘
scheme       host      port      path            query string   fragment
```

- The **path** tells the server *what* you want.
- The **query string** adds options (`page`, `search`). Laravel reads it with `$request->input('page')`.
- The **fragment** (`#top`) never reaches the server. Only the browser uses it.

## An HTTP request

```http
POST /api/v1/campuses HTTP/1.1
Host: api.school.edu
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
Accept: application/json

{"code": "MAIN", "name": "Main Campus"}
```

1. **Request line:** method, path, protocol version.
2. **Headers:** metadata as `Name: value` lines.
3. **Blank line.**
4. **Body** (optional): the data, here JSON.

### Methods (verbs)

| Method | Meaning | Has a body? | Safe to repeat? |
|---|---|---|---|
| `GET` | Read | no | yes |
| `POST` | Create / do an action | yes | no |
| `PUT` | Replace completely | yes | yes |
| `PATCH` | Change some fields | yes | usually |
| `DELETE` | Remove | rarely | yes |

"Safe to repeat" (**idempotent**) means sending it twice has the same effect as once. It matters when a network error makes the client retry.

## An HTTP response

```http
HTTP/1.1 201 Created
Content-Type: application/json
Cache-Control: no-store

{"success": true, "message": "Campus 'Main Campus' created successfully!"}
```

### Status codes

The first digit is the family:

| Family | Meaning | Codes you will use |
|---|---|---|
| `2xx` | It worked | `200 OK`, `201 Created`, `204 No Content` |
| `3xx` | Go somewhere else | `301`, `302` redirects (Blade apps) |
| `4xx` | **The client** made a mistake | `400` bad request, `401` not logged in, `403` not allowed, `404` not found, `409` conflict, `419` expired CSRF token (Blade), `422` invalid input, `429` too many requests |
| `5xx` | **The server** failed | `500` bug, `503` down for maintenance |

::: tip 401 vs 403
**401 Unauthorized** means "I don't know who you are": log in. **403 Forbidden** means "I know who you are, and you may not do this".
:::

### Headers you will meet

| Header | Direction | Purpose |
|---|---|---|
| `Content-Type` | both | Format of the body (`application/json`, `text/html`) |
| `Accept` | request | Format the client wants back. Send `application/json` to Laravel APIs so errors come back as JSON |
| `Authorization` | request | Credentials, e.g. `Bearer <token>` |
| `Cookie` / `Set-Cookie` | request / response | Small values the browser stores and sends back automatically |
| `Origin` | request | Which website made a browser request (used by CORS and CSRF checks) |
| `Cache-Control` | response | Whether the response may be cached |
| `Location` | response | Where a redirect or a newly created resource is |

## HTTP is stateless

The server forgets you after every response. To "stay logged in" the client must prove who it is **on every request**. There are two common ways:

| | Session cookie (classic web apps, Blade) | Token (APIs, SPAs, mobile) |
|---|---|---|
| After login the server... | stores a session and sends a cookie with its id | signs a token and sends it in the body |
| The client then sends... | the cookie, automatically | `Authorization: Bearer <token>`, explicitly |
| Server-side storage | session table / files | none for the access token |
| Used in these docs for | Blade pages | the API |

These docs use **both ideas together** for the API: a short-lived access token in memory plus a long-lived refresh token in an httpOnly cookie. See [JWT access tokens](/foundations/08-jwt-access-tokens) and [Refresh sessions](/foundations/09-refresh-sessions).

## What happens when you open a page

1. The browser asks **DNS** for the IP of the host.
2. It opens a **TCP** connection and a **TLS** (HTTPS) session.
3. It sends an **HTTP request**.
4. The web server (Nginx/Apache) hands PHP requests to **PHP-FPM**, which runs `public/index.php`: Laravel's single entry point.
5. Laravel **routes** the request, runs middleware, your controller, and returns a **response**.
6. For HTML, the browser then requests every CSS, JS and image file the page references, and renders it.

## Try it

Open your browser's **DevTools → Network** tab (F12) and reload any site. Click a request: you will see the method, URL, status, request headers, response headers and body, exactly as described above.

With `curl`:

```bash
curl -i https://example.com
```

`-i` prints the status line and headers before the body.

Next: [Web programming basics](/fundamentals/web-programming-basics)
