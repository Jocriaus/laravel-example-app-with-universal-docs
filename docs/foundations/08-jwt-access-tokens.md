# 08 · JWT access tokens

**Why:** an API is stateless, so every request must prove who sent it. We use a **JWT** (JSON Web Token): a small signed JSON document the server can check without a database lookup.

```
header.payload.signature
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzYw....Qm9ndXMgc2lnbmF0dXJl...
```

| Claim | Meaning |
|---|---|
| `sub` | user id |
| `exp` | expiry (15 minutes after issue) |
| `iat`, `iss`, `aud`, `jti` | issued at, issuer, audience, unique token id |
| `sid` | the login session it belongs to (step 09) |

We sign with **RS256**: a **private key** signs, a **public key** verifies. Only the server that issues tokens needs the private key.

::: warning A JWT is signed, not encrypted
Anyone can decode the payload (try jwt.io). Never put secrets in it.
:::

## Install

```bash
composer require lcobucci/jwt lcobucci/clock
```

## Generate the key pair

```bash
mkdir -p storage/keys
openssl genrsa -out storage/keys/private.key 4096
openssl rsa -in storage/keys/private.key -pubout -out storage/keys/public.key
```

On Windows, run these in **Git Bash** (it ships `openssl`), or use the `openssl.exe` from your PHP/XAMPP folder.

Keep the keys out of Git (`.gitignore`: `/storage/keys/*`), and restrict the private key's permissions on servers (`chmod 600`).

## Configuration

Replace `config/auth.php` with this version: the `api` guard uses a `jwt` driver, and the JWT and refresh-session settings live at the bottom.

::: details config/auth.php
**`config/auth.php`**

```php
<?php

return [

    'defaults' => [
        'guard' => env('AUTH_GUARD', 'api'),
        'passwords' => env('AUTH_PASSWORD_BROKER', 'users'),
    ],

    'guards' => [
        // Blade pages (session cookie)
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],

        // JSON API: "jwt" is registered by App\Providers\AuthServiceProvider
        'api' => [
            'driver' => 'jwt',
            'provider' => 'users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => env('AUTH_MODEL', App\Models\User::class),
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => env('AUTH_PASSWORD_RESET_TOKEN_TABLE', 'password_reset_tokens'),
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

    /*
    |--------------------------------------------------------------------------
    | JWT access tokens (foundation 08)
    |--------------------------------------------------------------------------
    */
    'jwt_private_key_path' => env('JWT_PRIVATE_KEY_PATH', 'storage/keys/private.key'),
    'jwt_public_key_path' => env('JWT_PUBLIC_KEY_PATH', 'storage/keys/public.key'),
    'jwt_ttl' => (int) env('JWT_TTL', 15),                 // access token lifetime, minutes
    'jwt_refresh_ttl' => (int) env('JWT_REFRESH_TTL', 20160), // ABSOLUTE session cap from login, minutes

    /*
    |--------------------------------------------------------------------------
    | Refresh sessions (foundation 09)
    |--------------------------------------------------------------------------
    */
    'refresh_token_pepper' => env('REFRESH_TOKEN_PEPPER'),                          // required, keep out of the DB
    'refresh_idle_ttl' => env('REFRESH_IDLE_TTL'),                                  // minutes unused; null = jwt_refresh_ttl
    'refresh_reuse_grace_seconds' => (int) env('REFRESH_REUSE_GRACE_SECONDS', 10),  // two-tab race window (409)

    'refresh_cookie' => [
        'name' => env('REFRESH_COOKIE_NAME', 'refresh_token'),
        'path' => env('REFRESH_COOKIE_PATH', '/api/v1/auth'),   // only sent to the auth endpoints
        'domain' => env('REFRESH_COOKIE_DOMAIN'),
        'secure' => env('REFRESH_COOKIE_SECURE', !env('APP_DEBUG', false)),
        'same_site' => env('REFRESH_COOKIE_SAMESITE', 'Strict'),
    ],

    // Frontend origins allowed to call login / refresh / logout (comma separated)
    'trusted_origins' => array_filter(array_map('trim', explode(',', (string) env('AUTH_TRUSTED_ORIGINS', '')))),
];
```

:::

Add to `.env` (and `.env.example`):

```ini
JWT_PRIVATE_KEY_PATH=storage/keys/private.key
JWT_PUBLIC_KEY_PATH=storage/keys/public.key
JWT_TTL=15
JWT_REFRESH_TTL=20160
```

## The JWT service

**`app/Services/JWT/JwtService.php`**

```php
<?php

namespace App\Services\JWT;

use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Constraint\LooseValidAt;
use Lcobucci\Clock\SystemClock;
use Lcobucci\JWT\Token;
use App\Models\User;
use App\Services\v1\modules\RefreshTokenService;
use DateTimeImmutable;

/**
 * Class JwtService
 *
 * Responsible for generating and validating JWT access tokens.
 * Each token carries `sid` = its refresh family. A token is valid only while
 * that family is active, so logout,
 * logout-all and reuse detection cut access off immediately.
 */
class JwtService
{
    /**
     * @var Configuration
     */
    private Configuration $config;

    /**
     * JwtService constructor.
     */
    public function __construct()
    {
        $privateKey = InMemory::file(self::keyPath('auth.jwt_private_key_path'));
        $publicKey = InMemory::file(self::keyPath('auth.jwt_public_key_path'));

        // 1. Initialize configuration
        $this->config = Configuration::forAsymmetricSigner(
            new Sha256(),
            $privateKey,
            $publicKey
        );

        // 2. Re-assign the config because the object is immutable!
        $this->config = $this->config->withValidationConstraints(
            new SignedWith($this->config->signer(), $publicKey),
            new LooseValidAt(SystemClock::fromSystemTimezone())
        );
    }

    /** Absolute path of a key file from config, with a clear error when it is missing. */
    private static function keyPath(string $configKey): string
    {
        $path = base_path((string) config($configKey));

        if (!is_file($path)) {
            throw new \RuntimeException("JWT key not found at {$path}. Generate the key pair (see foundation 08).");
        }

        return $path;
    }

    /**
     * Generate a JWT access token bound to a refresh family.
     */
    public function generateToken(User $user, string $familyId): string
    {
        $now = new DateTimeImmutable();

        $token = $this->config->builder()
            ->issuedBy(config('app.url'))                                 // iss
            ->permittedFor(config('app.url'))                               // aud
            ->identifiedBy(bin2hex(random_bytes(16)))           // jti
            ->issuedAt($now)
            ->expiresAt($now->modify('+' . config('auth.jwt_ttl') . ' minutes'))
            ->relatedTo((string) $user->id)                               // sub (cast to string for safety)
            ->withClaim('email', $user->email)
            ->withClaim('sid', $familyId)                                 // refresh family
            ->getToken($this->config->signer(), $this->config->signingKey());

        return $token->toString();
    }

    /**
     * Parse the given JWT token.
     */
    public function parseToken(string $token): Token
    {
        return $this->config->parser()->parse($token);
    }

    /**
     * Signature + expiry + the refresh family behind it is still active.
     * Tokens without `sid` are rejected.
     */
    public function validateToken(Token $token): bool
    {
        $constraints = $this->config->validationConstraints();

        if (!$this->config->validator()->validate($token, ...$constraints)) {
            return false;
        }

        return RefreshTokenService::isFamilyActive($token->claims()->get('sid'));
    }

    /**
     * The `sid` (refresh family) of a bearer token string, or null.
     */
    public function familyIdFromToken(?string $tokenString): ?string
    {
        if (!$tokenString) {
            return null;
        }

        try {
            return $this->parseToken($tokenString)->claims()->get('sid');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
```

`validateToken()` calls `RefreshTokenService::isFamilyActive()`, which you create in the next step. Until then only `generateToken()` and `parseToken()` can be used.

## The `api` guard

A **guard** answers "who is the current user?". Ours reads the Bearer token:

**`app/Auth/JwtGuard.php`**

```php
<?php

namespace App\Auth;

use App\Services\JWT\JwtService;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Http\Request;

/**
 * The "api" guard (config/auth.php: 'api' => ['driver' => 'jwt', 'provider' => 'users']).
 *
 * Reads "Authorization: Bearer <token>", validates it with JwtService (signature,
 * expiry, and that its refresh family is still active), and loads the user from `sub`.
 * The user is resolved once per request and cached.
 */
class JwtGuard implements Guard
{
    protected ?Authenticatable $user = null;

    public function __construct(
        protected UserProvider $provider,
        protected Request $request,
        protected JwtService $jwt,
    ) {
    }

    public function user(): ?Authenticatable
    {
        if ($this->user !== null) {
            return $this->user;
        }

        $tokenString = $this->request->bearerToken();

        if (!$tokenString) {
            return null;
        }

        try {
            $token = $this->jwt->parseToken($tokenString);

            if (!$this->jwt->validateToken($token)) {
                return null;
            }

            $user = $this->provider->retrieveById($token->claims()->get('sub'));
        } catch (\Throwable $e) {
            return null;
        }

        // Deleted (soft-deleted users are not found) or deactivated accounts are rejected.
        if (!$user || (isset($user->is_active) && !$user->is_active)) {
            return null;
        }

        return $this->user = $user;
    }

    public function check(): bool
    {
        return $this->user() !== null;
    }

    public function guest(): bool
    {
        return !$this->check();
    }

    public function id()
    {
        return $this->user()?->getAuthIdentifier();
    }

    /** Credential checks happen in AuthService, not in the guard. */
    public function validate(array $credentials = []): bool
    {
        return false;
    }

    public function hasUser(): bool
    {
        return $this->user !== null;
    }

    /** Used by tests: $this->actingAs($user, 'api'). */
    public function setUser(Authenticatable $user): static
    {
        $this->user = $user;

        return $this;
    }

    /** The guard is created once; point it at the current request (Octane / tests). */
    public function setRequest(Request $request): static
    {
        $this->request = $request;

        return $this;
    }
}
```


## Register the guard driver

**`app/Providers/AuthServiceProvider.php`**

```php
<?php

namespace App\Providers;

use App\Auth\JwtGuard;
use App\Services\JWT\JwtService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

/**
 * Registers the "jwt" guard driver used by the "api" guard in config/auth.php.
 * Add this class to bootstrap/providers.php.
 */
class AuthServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Auth::extend('jwt', function ($app, $name, array $config) {
            return new JwtGuard(
                Auth::createUserProvider($config['provider']),
                $app['request'],
                $app->make(JwtService::class),
            );
        });
    }
}
```

Add it to `bootstrap/providers.php`:

```php
return [
    App\Providers\AppServiceProvider::class,
    App\Providers\AuthServiceProvider::class,
];
```

Now `auth:api` middleware, `$request->user()` and `auth()->user()` use the JWT.

## Check it works

```bash
php artisan tinker
> app(App\Services\JWT\JwtService::class)->generateToken(App\Models\User::first(), (string) Str::uuid())
= "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
```

Paste the token into jwt.io: the payload shows `sub`, `exp` and `sid`.

Next: [09 · Refresh sessions](/foundations/09-refresh-sessions)
