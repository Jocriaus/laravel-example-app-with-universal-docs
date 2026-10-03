# Security basics

The mistakes below cause most real-world breaches. Laravel protects you from many of them **if you use it the intended way**.

## 1. Injection (SQL injection)

Building SQL from user input lets an attacker rewrite the query:

```php
// ❌ NEVER
DB::select("SELECT * FROM users WHERE email = '$email'");
// $email = "' OR '1'='1" returns every user
```

```php
// ✅ Eloquent / query builder / bindings escape values for you
User::where('email', $email)->first();
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
```

Also never pass user input as a **column name** (`orderBy($request->sort)`); use an allow-list. [Query traits](/foundations/05-query-traits) do this with `implementSort()`.

## 2. Broken authentication

- Hash passwords with `Hash::make()` (bcrypt/argon). Never store or log plain passwords.
- Give the **same error** for "no such account" and "wrong password", so attackers can't discover which emails exist.
- Rate-limit login (`throttle` middleware).
- Keep access tokens short-lived. Store long-lived refresh tokens in an **httpOnly** cookie and only as a **hash** on the server. [Refresh sessions](/foundations/09-refresh-sessions) does all of this.

## 3. Broken access control

Logged in does not mean allowed.

- Every route declares its permission ([RBAC](/foundations/10-rbac)).
- **IDOR** (insecure direct object reference): `GET /api/v1/files/57` must check that the user may see file 57, not just that the id exists. Scope queries to the user (`where('user_id', $user->id)`) or check ownership.
- Never trust ids or roles sent by the client (`user_role_id` in a profile update). Validate them, and only accept fields the user may change (`$fillable` + FormRequest).

## 4. Cross-site scripting (XSS)

An attacker stores JavaScript (for example in a name field) that later runs in other users' browsers.

::: v-pre
- Blade `{{ $value }}` **escapes** output. Use `{!! $value !!}` only for HTML you created yourself.
- In Vue/React, avoid `v-html` / `dangerouslySetInnerHTML` with user data.
- Keep tokens out of `localStorage` when you can: an XSS bug can read it, but not an httpOnly cookie.
:::

## 5. Cross-site request forgery (CSRF)

Another website makes the victim's browser send a request **with the victim's cookies**.

- Blade forms: `@csrf` adds a token that other sites can't know.
- Cookie-authenticated API endpoints: check the `Origin` header and use `SameSite` cookies ([Refresh sessions](/foundations/09-refresh-sessions)).
- `Authorization: Bearer` requests are not affected: browsers never add that header by themselves.

## 6. Sensitive data exposure

- HTTPS everywhere in production.
- Return only the fields the client needs, through **API resources**. Never return raw models (they may include hashes or internal columns).
- `APP_DEBUG=false` in production. Debug pages show your environment variables.
- Secrets live in `.env`, never in Git. Rotate any secret that was committed.

## 7. Mass assignment

```php
// ❌ the client could send "user_role_id": 1 and become an administrator
$user->update($request->all());

// ✅ only validated fields, and only fields listed in $fillable
$user->update($request->validated());
```

## 8. File uploads

- Validate type and size (`mimes:pdf,jpg|max:2048`).
- Store outside `public/` (the **private** disk) under a generated name.
- Serve through a controller or a **signed, expiring URL** ([File uploads](/foundations/12-file-uploads)).

## 9. Logging and monitoring

- Log security events (logins, logouts, refresh-token reuse, permission changes) to the activity log.
- Never log secrets: passwords, tokens, peppers, full card numbers.

## 10. Dependencies

Run `composer audit` and `npm audit` regularly and update vulnerable packages.

## Checklist

- [ ] Every query uses Eloquent/bindings; sort columns come from an allow-list
- [ ] Every route has authentication **and** a permission check
- [ ] Records are scoped to what the user may see
- [ ] Output goes through resources; `APP_DEBUG=false` in production
- [ ] Controllers only use `$request->validated()`
- [ ] Login is rate-limited and doesn't reveal which accounts exist
- [ ] Uploads are validated, private, and served through a controller or a signed URL
- [ ] No secrets in Git or logs

Next: [Prerequisites](/start/prerequisites)
