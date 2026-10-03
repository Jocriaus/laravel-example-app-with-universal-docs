# 09 · Refresh sessions

**Why:** access tokens must be short-lived (15 minutes) so a stolen one is soon useless, but users shouldn't log in every 15 minutes. A **refresh token** gets new access tokens. This step builds login, refresh, logout and logout-all around it, safely.

## How it works

| | Access token | Refresh token |
|---|---|---|
| What | RS256 JWT (step 08) | 64 random characters (384 bits) |
| Lifetime | 15 minutes | idle timeout, capped by an absolute limit from login |
| Client keeps it | in memory | **httpOnly cookie**, only sent to `/api/v1/auth` |
| Server keeps | nothing | only an **HMAC-SHA256 hash** (`refresh_sessions` table) |

```
login          row A active                              family F (one device)
refresh #1     row A revoked "rotated" ─► row B active
refresh #2     row B revoked "rotated" ─► row C active
logout         family F revoked → every access token with sid=F stops working at once
```

- **Rotation:** every refresh returns a *new* refresh token; the old one is dead.
- **Reuse detection:** if a dead (rotated) token comes back after 10 seconds, it was copied: the whole family is revoked. Within 10 seconds it's two browser tabs racing, so the answer is **409, retry**.
- **Instant logout:** each access token carries `sid` = its family. `JwtService::validateToken()` rejects tokens whose family is no longer active.
- **CSRF:** the cookie is sent automatically by the browser, so cookie endpoints check the `Origin` header.

## 1. Settings

Generate the **pepper** (the HMAC key; kept out of the database so a database dump alone can't check stolen tokens):

```bash
php -r "echo rtrim(strtr(base64_encode(random_bytes(64)), '+/', '-_'), '='), PHP_EOL;"
```

Add to `.env` (and placeholders to `.env.example`):

```ini
REFRESH_TOKEN_PEPPER=<the value printed above>
REFRESH_IDLE_TTL=
REFRESH_REUSE_GRACE_SECONDS=10
AUTH_TRUSTED_ORIGINS=http://localhost:5173
```

The matching keys are already in the `config/auth.php` from step 08.

## 2. Table and model

```bash
php artisan make:migration create_refresh_sessions_table
```

**`database/migrations/2026_10_01_000010_create_refresh_sessions_table.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per refresh token. Rows of one login share a family_id.
 * Rotation revokes the presented row (reason "rotated") and inserts the next
 * one in the same family, linked through replaced_by_id.
 * Only the HMAC hash of a token is stored, never the token itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refresh_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('family_id');
            $table->char('token_hash', 64)->unique();
            // DATETIME, not TIMESTAMP: with MySQL's explicit_defaults_for_timestamp=OFF a
            // NOT NULL TIMESTAMP gets an implicit default ('0000-00-00', rejected in strict
            // mode) and the FIRST one also gets ON UPDATE CURRENT_TIMESTAMP, which would
            // silently move session_started_at on every revoke and break the absolute cap.
            $table->dateTime('session_started_at');           // login time; absolute cap is measured from here
            $table->dateTime('expires_at');                   // min(now + idle, started + absolute)
            $table->dateTime('created_at')->nullable();
            $table->dateTime('revoked_at')->nullable();
            $table->string('revoked_reason', 32)->nullable();
            $table->foreignId('replaced_by_id')->nullable()->constrained('refresh_sessions')->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->default('');

            $table->index(['family_id', 'revoked_at', 'expires_at']);  // is_family_active on every request
            $table->index(['user_id', 'revoked_at']);                 // logout-all, session list
            $table->index('expires_at');                              // purge
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_sessions');
    }
};
```

**`app/Models/RefreshSessionBuilder.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;

/**
 * Query helpers for refresh_sessions: ->active() and ->revoke($reason).
 */
class RefreshSessionBuilder extends Builder
{
    /** Not revoked and not expired. */
    public function active(): static
    {
        return $this->whereNull('revoked_at')->where('expires_at', '>', now());
    }

    /** Revoke every not-yet-revoked row in the query. Returns the number of rows revoked. */
    public function revoke(string $reason): int
    {
        return $this->whereNull('revoked_at')->update([
            'revoked_at' => now(),
            'revoked_reason' => $reason,
        ]);
    }
}
```

**`app/Models/RefreshSession.php`**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 *
 * @method static RefreshSessionBuilder query()
 */
class RefreshSession extends Model
{
    public const REASON_ROTATED = 'rotated';
    public const REASON_LOGOUT = 'logout';
    public const REASON_LOGOUT_ALL = 'logout_all';
    public const REASON_REUSE_DETECTED = 'reuse_detected';
    public const REASON_USER_INACTIVE = 'user_inactive';
    public const REASON_PASSWORD_CHANGED = 'password_changed';
    public const REASON_PASSWORD_RESET = 'password_reset';
    public const REASON_REVOKED_BY_USER = 'revoked_by_user';

    const UPDATED_AT = null; // rows are append-only apart from revocation

    protected $fillable = [
        'user_id',
        'family_id',
        'token_hash',
        'session_started_at',
        'expires_at',
        'created_at',
        'revoked_at',
        'revoked_reason',
        'replaced_by_id',
        'ip_address',
        'user_agent',
    ];

    protected $hidden = [
        'token_hash',
    ];

    protected function casts(): array
    {
        return [
            'session_started_at' => 'datetime',
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function newEloquentBuilder($query): RefreshSessionBuilder
    {
        return new RefreshSessionBuilder($query);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replacedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaced_by_id');
    }
}
```


## 3. Small value objects and exceptions

::: details app/Support/Auth and app/Exceptions/Auth
**`app/Support/Auth/ClientInfo.php`**

```php
<?php

namespace App\Support\Auth;

use Illuminate\Http\Request;

final class ClientInfo
{
    public function __construct(
        public readonly ?string $ipAddress = null,
        public readonly string $userAgent = '',
    ) {
    }

    public static function fromRequest(Request $request): self
    {
        $ip = $request->ip();

        return new self(
            // Malformed / spoofed X-Forwarded-For -> null
            ipAddress: $ip && filter_var($ip, FILTER_VALIDATE_IP) ? $ip : null,
            userAgent: mb_substr((string) $request->userAgent(), 0, 512),
        );
    }
}
```

**`app/Support/Auth/IssuedTokens.php`**

```php
<?php

namespace App\Support\Auth;

use App\Models\RefreshSession;
use App\Models\User;
use Carbon\CarbonInterface;

final class IssuedTokens
{
    public function __construct(
        public readonly string $access,
        public readonly int $accessExpiresIn,           // seconds; relative, so client clock skew is irrelevant
        public readonly string $refresh,                // RAW token: goes into the cookie, never into a response body
        public readonly CarbonInterface $refreshExpiresAt,
        public readonly RefreshSession $session,
    ) {
    }

    public function user(): User
    {
        return $this->session->user;
    }
}
```

**`app/Exceptions/Auth/RefreshTokenException.php`**

```php
<?php

namespace App\Exceptions\Auth;

use Exception;

class RefreshTokenException extends Exception
{
    public const DEFAULT_MESSAGE = 'Your session has expired. Please log in again.';

    public function __construct(?string $message = null, public readonly string $errorCode = 'refresh_invalid')
    {
        parent::__construct($message ?? self::DEFAULT_MESSAGE);
    }
}
```

**`app/Exceptions/Auth/RefreshTokenReuseException.php`**

```php
<?php

namespace App\Exceptions\Auth;

use App\Models\User;

class RefreshTokenReuseException extends RefreshTokenException
{
    public function __construct(public readonly ?User $user, public readonly string $familyId)
    {
        parent::__construct('This session was ended for security reasons. Please log in again.', 'refresh_reused');
    }
}
```

**`app/Exceptions/Auth/RefreshTokenConcurrentUseException.php`**

```php
<?php

namespace App\Exceptions\Auth;

use Exception;

class RefreshTokenConcurrentUseException extends Exception
{
    public function __construct()
    {
        parent::__construct('Session is being refreshed by another request. Please retry.');
    }
}
```

**`app/Exceptions/Auth/InvalidCredentialsException.php`**

```php
<?php

namespace App\Exceptions\Auth;

use Exception;

/** Wrong email, wrong password, deactivated or deleted: one message for all (no account enumeration). */
class InvalidCredentialsException extends Exception
{
    public function __construct()
    {
        parent::__construct('Invalid email or password. Please try again.');
    }
}
```

:::

## 4. The refresh token service

Every token decision lives here. Read the class comment first.

**`app/Services/v1/modules/RefreshTokenService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Exceptions\Auth\RefreshTokenConcurrentUseException;
use App\Exceptions\Auth\RefreshTokenException;
use App\Exceptions\Auth\RefreshTokenReuseException;
use App\Models\RefreshSession;
use App\Models\User;
use App\Services\JWT\JwtService;
use App\Support\Auth\ClientInfo;
use App\Support\Auth\IssuedTokens;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Refresh Token Service
 * ==================================================================
 * All refresh-session business logic lives here. Controllers only translate
 * HTTP (cookies, headers, status codes) to and from these methods.
 *
 * Access token  - RS256 JWT (JwtService), short-lived, sent as Bearer. Carries a
 *                 `sid` claim = the refresh family, so it can be revoked early.
 * Refresh token - 384-bit random opaque string. Lives only in an httpOnly cookie
 *                 on the client and only as an HMAC-SHA256 hash on the server.
 *
 * HMAC and not bcrypt: slow hashes protect LOW-entropy secrets. A 384-bit token
 * cannot be brute forced, a fast hash is deterministic (indexed lookup), and the
 * pepper lives outside the database, so a DB dump alone can't verify a guess.
 *
 * Rotation: every refresh revokes the presented row (reason "rotated") and issues
 * the next one in the same family. A rotated row presented again:
 *   - within the grace window -> two tabs racing: RefreshTokenConcurrentUseException (409)
 *   - after it                -> replay: revoke the WHOLE family, RefreshTokenReuseException (401)
 */
class RefreshTokenService
{
    /** random_bytes(48) -> 384 bits -> 64 URL-safe chars */
    public const RAW_TOKEN_BYTES = 48;

    public function __construct(private readonly JwtService $jwt)
    {
    }

    // ------------------------------------------------------------------
    // Hashing & lifetimes
    // ------------------------------------------------------------------

    public static function hashRefreshToken(string $raw): string
    {
        $pepper = (string) config('auth.refresh_token_pepper');

        if ($pepper === '') {
            throw new RuntimeException(
                'REFRESH_TOKEN_PEPPER is not set. Generate one with: '
                . 'php -r "echo rtrim(strtr(base64_encode(random_bytes(64)), \'+/\', \'-_\'), \'=\'), PHP_EOL;"'
            );
        }

        return hash_hmac('sha256', $raw, $pepper);
    }
    public static function generateRawToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(self::RAW_TOKEN_BYTES)), '+/', '-_'), '=');
    }

    /** Hard cap measured from login, in minutes (auth.jwt_refresh_ttl). */
    private static function absoluteLifetimeMinutes(): int
    {
        return (int) config('auth.jwt_refresh_ttl', 20160);
    }

    /** How long one refresh token lives if never used (auth.refresh_idle_ttl, defaults to absolute). */
    private static function idleLifetimeMinutes(): int
    {
        return (int) (config('auth.refresh_idle_ttl') ?: self::absoluteLifetimeMinutes());
    }

    private static function reuseGraceSeconds(): int
    {
        return (int) config('auth.refresh_reuse_grace_seconds', 10);
    }

    /** min(now + idle, session_started_at + absolute) */
    public static function rowExpiry(CarbonInterface $sessionStartedAt, CarbonInterface $now): CarbonInterface
    {
        $idle = $now->copy()->addMinutes(self::idleLifetimeMinutes());
        $absolute = $sessionStartedAt->copy()->addMinutes(self::absoluteLifetimeMinutes());

        return $idle->lessThan($absolute) ? $idle : $absolute;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /** Start a brand-new session family after a successful login. */
    public function issueForLogin(User $user, ClientInfo $client): IssuedTokens
    {
        $now = now();

        [$row, $raw] = $this->createRow($user, (string) Str::uuid(), $now, $now, $client);

        return $this->package($row, $raw);
    }

    /**
     * Exchange a refresh token for a new access token AND a new refresh token.
     *
     * @throws RefreshTokenConcurrentUseException benign race, client should retry (409)
     * @throws RefreshTokenReuseException         replay detected, family revoked (401)
     * @throws RefreshTokenException              missing/unknown/expired/revoked (401)
     */
    public function rotate(?string $raw, ClientInfo $client): IssuedTokens
    {
        if (!$raw) {
            throw new RefreshTokenException(errorCode: 'refresh_missing');
        }

        $tokenHash = self::hashRefreshToken($raw);
        $now = now();
        $failure = null;
        $newRow = $newRaw = null;

        // Revocations must COMMIT even when the request is rejected, so the
        // closure never throws after writing; it records $failure and we throw after.
        DB::transaction(function () use ($tokenHash, $now, $client, &$failure, &$newRow, &$newRaw) {
            $row = RefreshSession::query()
                ->where('token_hash', $tokenHash)
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                $failure = new RefreshTokenException(errorCode: 'refresh_invalid');
                return;
            }

            $user = User::find($row->user_id); // soft-deleted users count as inactive

            if ($row->revoked_at !== null) {
                $rotated = $row->revoked_reason === RefreshSession::REASON_ROTATED;

                if ($rotated && $now->lessThanOrEqualTo($row->revoked_at->copy()->addSeconds(self::reuseGraceSeconds()))) {
                    $failure = new RefreshTokenConcurrentUseException();
                } elseif ($rotated) {
                    RefreshSession::query()->where('family_id', $row->family_id)->revoke(RefreshSession::REASON_REUSE_DETECTED);
                    $failure = new RefreshTokenReuseException(User::withTrashed()->find($row->user_id), $row->family_id);
                } else {
                    $failure = new RefreshTokenException(errorCode: 'refresh_revoked');
                }
                return;
            }

            if ($row->expires_at->lessThanOrEqualTo($now)) {
                $failure = new RefreshTokenException(errorCode: 'refresh_expired');
                return;
            }

            if (!$user || !$user->is_active) {
                RefreshSession::query()->where('family_id', $row->family_id)->revoke(RefreshSession::REASON_USER_INACTIVE);
                $failure = new RefreshTokenException(errorCode: 'user_inactive');
                return;
            }

            [$newRow, $newRaw] = $this->createRow(
                $user,
                $row->family_id,
                $row->session_started_at, // absolute cap carries over
                $now,
                $client,
            );

            $row->forceFill([
                'revoked_at' => $now,
                'revoked_reason' => RefreshSession::REASON_ROTATED,
                'replaced_by_id' => $newRow->id,
            ])->save();
        });

        if ($failure !== null) {
            throw $failure;
        }

        return $this->package($newRow, $newRaw);
    }

    /**
     * Revoke the whole family the given raw token belongs to (logout).
     * Idempotent: returns the matched row (for audit logging) or null.
     */
    public function revokeSessionFamily(?string $raw, string $reason = RefreshSession::REASON_LOGOUT): ?RefreshSession
    {
        if (!$raw) {
            return null;
        }

        $row = RefreshSession::query()->with('user')->where('token_hash', self::hashRefreshToken($raw))->first();

        if ($row === null) {
            return null;
        }

        RefreshSession::query()->where('family_id', $row->family_id)->revoke($reason);

        return $row;
    }

    /** Log a user out everywhere (logout-all, password reset, deactivation). */
    public function revokeAllForUser(User $user, string $reason = RefreshSession::REASON_LOGOUT_ALL): int
    {
        return RefreshSession::query()->where('user_id', $user->id)->revoke($reason);
    }

    /** Every family of the user except one (password change keeps the current device). */
    public function revokeOtherFamilies(User $user, ?string $keepFamilyId, string $reason): int
    {
        return RefreshSession::query()
            ->where('user_id', $user->id)
            ->when($keepFamilyId, fn ($q) => $q->where('family_id', '!=', $keepFamilyId))
            ->revoke($reason);
    }

    /** True while the login session behind an access token is still valid. */
    public static function isFamilyActive(?string $familyId): bool
    {
        if (!$familyId || !Str::isUuid($familyId)) {
            return false;
        }

        return RefreshSession::query()->active()->where('family_id', $familyId)->exists();
    }

    /** Housekeeping: delete rows that expired more than $olderThanDays ago. */
    public function purgeExpired(int $olderThanDays): int
    {
        return RefreshSession::query()->where('expires_at', '<', now()->subDays($olderThanDays))->delete();
    }

    // ------------------------------------------------------------------
    // Internal builders
    // ------------------------------------------------------------------

    /** @return array{0: RefreshSession, 1: string} */
    private function createRow(User $user, string $familyId, CarbonInterface $sessionStartedAt, CarbonInterface $now, ClientInfo $client): array
    {
        $raw = self::generateRawToken();

        $row = RefreshSession::create([
            'user_id' => $user->id,
            'family_id' => $familyId,
            'token_hash' => self::hashRefreshToken($raw),
            'session_started_at' => $sessionStartedAt,
            'expires_at' => self::rowExpiry($sessionStartedAt, $now),
            'created_at' => $now,
            'ip_address' => $client->ipAddress,
            'user_agent' => mb_substr($client->userAgent, 0, 512),
        ]);

        $row->setRelation('user', $user);

        return [$row, $raw];
    }

    private function package(RefreshSession $row, string $raw): IssuedTokens
    {
        return new IssuedTokens(
            access: $this->jwt->generateToken($row->user, $row->family_id),
            accessExpiresIn: (int) config('auth.jwt_ttl', 15) * 60,
            refresh: $raw,
            refreshExpiresAt: $row->expires_at,
            session: $row,
        );
    }
}
```


## 5. The auth service

Credentials, passwords and audit logging:

**`app/Services/v1/modules/AuthService.php`**

```php
<?php

namespace App\Services\v1\modules;

use App\Exceptions\Auth\InvalidCredentialsException;
use App\Helpers\ActivityLogHelper;
use App\Models\RefreshSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Credentials, passwords and audit logging.
 * Every token decision lives in RefreshTokenService.
 */
class AuthService
{
    /** bcrypt (cost 12) of a random string nobody knows; only used to equalise timing. */
    private const DUMMY_HASH = '$2y$12$ZRue8hjHAGovT/EK0tEKrOhfjKS539DhpcQ0GaXgm7Zk5orxqtm3i';

    public function __construct(private readonly RefreshTokenService $refreshTokens)
    {
    }

    /**
     * Wrong email, wrong password, deactivated and soft-deleted accounts all get the
     * same error, so the endpoint can't be used to find out which accounts exist.
     */
    public function authenticate(string $email, string $password): User
    {
        $user = User::where('email', $email)->first();

        // Hash against a dummy when the user doesn't exist, so response time
        // doesn't reveal whether the email is registered.
        $hash = $user?->password ?? self::DUMMY_HASH;
        $passwordOk = Hash::check($password, $hash);

        if (!$user || !$passwordOk || !$user->is_active) {
            throw new InvalidCredentialsException();
        }

        return $user;
    }

    public function logLogin(User $user): void
    {
        ActivityLogHelper::log([
            'log_name' => 'auth',
            'event' => 'USER_LOGIN',
            'message' => "User '{$user->email}' authenticated and logged in successfully.",
            'causer' => $user,
            'changes' => [],
            'payload' => ['email' => $user->email],
            'response' => ['success' => true, 'message' => "User {$user->email} logged in successfully!"],
            'subject' => $user,
        ]);
    }

    public function logLogout(?RefreshSession $row): void
    {
        $user = $row?->user;

        ActivityLogHelper::log([
            'log_name' => 'auth',
            'event' => 'USER_LOGOUT',
            'message' => $user
                ? "User '{$user->email}' logged out; session revoked."
                : 'Logout requested without an active session cookie.',
            'causer' => $user,
            'changes' => $row ? ['family_id' => $row->family_id] : [],
            'payload' => [],
            'response' => ['success' => true, 'message' => 'Logged out successfully.'],
            'subject' => $user,
        ]);
    }

    public function logLogoutAll(User $user, int $count): void
    {
        ActivityLogHelper::log([
            'log_name' => 'auth',
            'event' => 'USER_LOGOUT_ALL',
            'message' => "User '{$user->email}' logged out of all devices ({$count} session row(s) revoked).",
            'causer' => $user,
            'changes' => ['rows_revoked' => $count],
            'payload' => [],
            'response' => ['success' => true, 'message' => 'Logged out of all devices.'],
            'subject' => $user,
        ]);
    }
    public function logReuseDetected(?User $user, string $familyId, array $client): void
    {
        ActivityLogHelper::log([
            'log_name' => 'auth',
            'event' => 'REFRESH_TOKEN_REUSE_DETECTED',
            'message' => "A rotated refresh token for '" . ($user?->email ?? 'unknown') . "' was replayed. "
                . 'All sessions from that login were revoked.',
            'causer' => $user,
            'changes' => ['family_id' => $familyId, 'status' => 'FAILED'],
            'payload' => $client,
            'response' => ['success' => false, 'message' => 'This session was ended for security reasons. Please log in again.'],
            'subject' => $user,
        ]);
    }

    /**
     * Change own password; every OTHER device is logged out.
     */
    public function changePasswordService(array $validated, ?string $currentFamilyId)
    {
        $user = auth()->user();
        $user->password = Hash::make($validated['password']);
        $user->save();

        $revoked = $this->refreshTokens->revokeOtherFamilies($user, $currentFamilyId, RefreshSession::REASON_PASSWORD_CHANGED);

        $response = (object) [
            'success' => true,
            'message' => 'Password changed successfully.',
        ];

        ActivityLogHelper::log([
            'log_name' => 'auth',
            'event' => 'reset_password',
            'message' => "User $user->email reset their password.",
            'changes' => ['other_session_rows_revoked' => $revoked],
            'payload' => ['email' => $user->email],
            'response' => $response,
            'subject' => $user,
        ]);

        return $response;
    }

    /**
     * Admin resets a user's password to the default; that user is logged out everywhere.
     */
    public function adminSidePasswordResestService($userId)
    {
        $currentUser = auth()->user();
        $year = Carbon::now()->year;
        $user = User::findOrFail($userId);
        $user->password = Hash::make("icto-{$year}");
        $user->save();

        $revoked = $this->refreshTokens->revokeAllForUser($user, RefreshSession::REASON_PASSWORD_RESET);

        $response = (object) [
            'success' => true,
            'message' => 'Password changed successfully.',
        ];

        ActivityLogHelper::log([
            'log_name' => 'auth',
            'event' => 'reset_password',
            'message' => "User $currentUser->email has reset the password for $user->email.",
            'changes' => ['session_rows_revoked' => $revoked],
            'payload' => ['email' => $user->email],
            'response' => $response,
            'subject' => $user,
        ]);

        return $response;
    }
}
```


## 6. The origin check

**`app/Http/Middleware/TrustedOriginMiddleware.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 *
 * CSRF defence for the cookie-authenticated endpoints (login, refresh, logout).
 * The browser attaches the refresh cookie automatically, so the request must come
 * from OUR frontend:
 *   - Browsers always send Origin on cross-origin POSTs and pages can't forge it,
 *     so a present Origin must be on the allow-list.
 *   - With no Origin (old browsers, server tools), require X-Requested-With:
 *     XMLHttpRequest, which a cross-site form can't set and a cross-site fetch
 *     can't send without passing the CORS preflight.
 */
class TrustedOriginMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');

        if ($origin) {
            if (!in_array(rtrim($origin, '/'), $this->trustedOrigins($request), true)) {
                return $this->deny('Request origin is not allowed.');
            }

            return $next($request);
        }

        if ($request->headers->get('X-Requested-With') !== 'XMLHttpRequest') {
            return $this->deny('Missing required X-Requested-With header.');
        }

        return $next($request);
    }

    /** auth.trusted_origins + cors.allowed_origins (no wildcards) + APP_URL + same origin. */
    private function trustedOrigins(Request $request): array
    {
        $configured = array_merge(
            (array) config('auth.trusted_origins', []),
            (array) config('cors.allowed_origins', []),
            [config('app.url')],
        );

        $origins = [];
        foreach ($configured as $origin) {
            $origin = rtrim(trim((string) $origin), '/');
            if ($origin !== '' && !str_contains($origin, '*')) {
                $origins[] = $origin;
            }
        }

        $origins[] = $request->getSchemeAndHttpHost(); // same-origin (e.g. Scramble docs)

        return array_values(array_unique($origins));
    }

    private function deny(string $message): Response
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 'permission_denied',
        ], 403);
    }
}
```


## 7. Resources

**`app/Http/Resources/v1/modules/auth/MeResource.php`** (step 12 adds signature_url)

```php
<?php

namespace App\Http\Resources\v1\modules\auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** The logged-in user as the frontend sees it. */
class MeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'user_role' => $this->userRole?->only(['id', 'name']),
            'is_active' => $this->is_active,
        ];
    }
}
```

**`app/Http/Resources/v1/modules/auth/SessionResource.php`**

```php
<?php

namespace App\Http\Resources\v1\modules\auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** One logged-in device = the active row of a refresh family. */
class SessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'session_id' => $this->family_id,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'is_current' => (bool) $this->is_current,
            'logged_in_at' => $this->session_started_at?->toIso8601String(),
            'last_refreshed_at' => $this->created_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
        ];
    }
}
```


## 8. The controller

HTTP only: cookies, headers, status codes.

**`app/Http/Controllers/API/v1/modules/AuthController.php`** (step 10 swaps MeResource for UserWithPermissionsResource)

```php
<?php

namespace App\Http\Controllers\API\v1\modules;

use App\Exceptions\Auth\InvalidCredentialsException;
use App\Exceptions\Auth\RefreshTokenConcurrentUseException;
use App\Exceptions\Auth\RefreshTokenException;
use App\Exceptions\Auth\RefreshTokenReuseException;
use App\Http\Controllers\Controller;
use App\Http\Resources\v1\modules\auth\MeResource;
use App\Http\Resources\v1\modules\auth\SessionResource;
use App\Models\RefreshSession;
use App\Services\JWT\JwtService;
use App\Services\v1\modules\AuthService;
use App\Services\v1\modules\RefreshTokenService;
use App\Support\Auth\ClientInfo;
use App\Support\Auth\IssuedTokens;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Authentication
 *
 * HTTP concerns only (cookies, origin checks, status codes). Every token
 * decision is made in RefreshTokenService.
 *
 *   POST /api/v1/auth/login          -> access token in body, refresh token in cookie
 *   POST /api/v1/auth/token/refresh  -> rotate; ?include_user=1 on app start
 *   POST /api/v1/auth/logout         -> revoke this device's session (uses the cookie)
 *   POST /api/v1/auth/logout-all     -> revoke every session (needs the access token)
 *
 * The refresh cookie's Path is /api/v1/auth, so it is never sent to other endpoints.
 */
class AuthController extends Controller
{
    /**
     * Log in user.
     *
     * Returns the access token in the body and sets the refresh token as an
     * httpOnly cookie. Requires a trusted Origin (or X-Requested-With: XMLHttpRequest).
     *
     * @unauthenticated
     */
    public function login(Request $request, AuthService $authService, RefreshTokenService $refreshTokens)
    {
        try {
            $credentials = $request->validate([
                // @example admin@email.com
                'email' => 'required|string|email',
                // @example admin
                'password' => 'required|string',
            ]);

            $user = $authService->authenticate($credentials['email'], $credentials['password']);
            $tokens = $refreshTokens->issueForLogin($user, ClientInfo::fromRequest($request));
            $authService->logLogin($user);

            $response = response()->json([
                'success' => true,
                'message' => "User {$user->email} logged in successfully!",
                'data' => [
                    'access' => $tokens->access,
                    'access_expires_in' => $tokens->accessExpiresIn,
                    'user' => MeResource::make($user),
                ],
            ], 200);

            return $this->setRefreshCookie($response, $tokens);

        } catch (ValidationException $e) {
            return $this->error(collect($e->errors())->flatten()->first(), 'invalid', 422);
        } catch (InvalidCredentialsException $e) {
            return $this->error($e->getMessage(), 'invalid_credentials', 401, authenticate: true);
        } catch (\Exception $e) {
            return $this->error(config('app.debug') ? $e->getMessage() : 'Internal Server Error', 'error', 500);
        }
    }

    /**
     * Refresh session.
     *
     * Rotates the refresh cookie and returns a new access token.
     * Add ?include_user=1 on app start to also get the user with permissions.
     * - 200: refreshed
     * - 409: another tab refreshed at the same moment; retry (the cookie is already new)
     * - 401: session is over (code: refresh_missing, refresh_invalid, refresh_revoked,
     *        refresh_expired, refresh_reused, user_inactive); send the user to login
     *
     * Successful refreshes are deliberately not written to the activity log.
     *
     * @unauthenticated
     */
    public function refreshToken(Request $request, AuthService $authService, RefreshTokenService $refreshTokens)
    {
        $client = ClientInfo::fromRequest($request);

        try {
            $tokens = $refreshTokens->rotate($request->cookie($this->cookieConf()['name']), $client);

            $data = [
                'access' => $tokens->access,
                'access_expires_in' => $tokens->accessExpiresIn,
            ];

            if (in_array(strtolower((string) $request->query('include_user')), ['1', 'true', 'yes'], true)) {
                $data['user'] = MeResource::make($tokens->user());
            }

            $response = response()->json([
                'success' => true,
                'message' => 'Session refreshed.',
                'data' => $data,
            ], 200);

            return $this->setRefreshCookie($response, $tokens);

        } catch (RefreshTokenConcurrentUseException $e) {
            // Do NOT touch the cookie: the parallel request already set a fresh one.
            return $this->error($e->getMessage(), 'refresh_in_progress', 409);
        } catch (RefreshTokenReuseException $e) {
            // Security event: logged explicitly so it has its own searchable name.
            $authService->logReuseDetected($e->user, $e->familyId, ['ip' => $client->ipAddress, 'user_agent' => $client->userAgent]);

            return $this->clearRefreshCookie($this->error($e->getMessage(), $e->errorCode, 401, authenticate: true));
        } catch (RefreshTokenException $e) {
            // Dead session -> remove the useless cookie.
            return $this->clearRefreshCookie($this->error($e->getMessage(), $e->errorCode, 401, authenticate: true));
        } catch (\Exception $e) {
            return $this->error(config('app.debug') ? $e->getMessage() : 'Internal Server Error', 'error', 500);
        }
    }

    /**
     * Log out this device.
     *
     * Revokes the session family of the refresh cookie and clears the cookie.
     * Works even when the access token has already expired. Idempotent.
     *
     * @unauthenticated
     */
    public function logout(Request $request, AuthService $authService, RefreshTokenService $refreshTokens)
    {
        try {
            $row = $refreshTokens->revokeSessionFamily(
                $request->cookie($this->cookieConf()['name']),
                RefreshSession::REASON_LOGOUT
            );

            $authService->logLogout($row);

            return $this->clearRefreshCookie(response()->json([
                'success' => true,
                'message' => 'Logged out successfully.',
                'data' => null,
            ], 200));

        } catch (\Exception $e) {
            return $this->error(config('app.debug') ? $e->getMessage() : 'Internal Server Error', 'error', 500);
        }
    }

    /**
     * Log out of all devices.
     *
     * Revokes every session of the authenticated user. Access tokens of all devices
     * stop working immediately.
     *
     * @authenticated
     */
    public function logoutAll(Request $request, AuthService $authService, RefreshTokenService $refreshTokens)
    {
        try {
            $user = $request->user();
            $count = $refreshTokens->revokeAllForUser($user, RefreshSession::REASON_LOGOUT_ALL);

            $authService->logLogoutAll($user, $count);

            return $this->clearRefreshCookie(response()->json([
                'success' => true,
                'message' => 'Logged out of all devices.',
                'data' => null,
            ], 200));

        } catch (\Exception $e) {
            return $this->error(config('app.debug') ? $e->getMessage() : 'Internal Server Error', 'error', 500);
        }
    }

    /**
     * List active sessions.
     *
     * Every device the authenticated user is logged in on. The device making the
     * request has is_current = true.
     *
     * @authenticated
     */
    public function viewSessions(Request $request, JwtService $jwt)
    {
        try {
            $currentFamilyId = $jwt->familyIdFromToken($request->bearerToken());

            $sessions = RefreshSession::query()
                ->active()
                ->where('user_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->get()
                ->each(fn ($row) => $row->setAttribute('is_current', $row->family_id === $currentFamilyId));

            return SessionResource::collection($sessions)->additional([
                'success' => true,
                'message' => 'Active sessions fetched successfully.',
            ]);
        } catch (\Exception $e) {
            return $this->error(config('app.debug') ? $e->getMessage() : 'Internal Server Error', 'error', 500);
        }
    }

    /**
     * Log out one device.
     *
     * Revokes one of the authenticated user's own sessions, e.g. a lost phone.
     *
     * @authenticated
     */
    public function revokeSession(Request $request, JwtService $jwt, string $familyId)
    {
        try {
            $count = RefreshSession::query()
                ->where('user_id', $request->user()->id)
                ->where('family_id', $familyId)
                ->revoke(RefreshSession::REASON_REVOKED_BY_USER);

            if ($count === 0) {
                return $this->error('Session not found or already logged out.', 'not_found', 404);
            }

            $response = response()->json([
                'success' => true,
                'message' => 'Session logged out successfully.',
                'data' => null,
            ], 200);

            return $familyId === $jwt->familyIdFromToken($request->bearerToken())
                ? $this->clearRefreshCookie($response)
                : $response;
        } catch (\Exception $e) {
            return $this->error(config('app.debug') ? $e->getMessage() : 'Internal Server Error', 'error', 500);
        }
    }

    /**
     * Change Password
     *
     * Update the password from the user's own view. Every OTHER device is logged out.
     *
     * @authenticated
     */
    public function changePassword(Request $request, JwtService $jwt, AuthService $authService)
    {
        try {
            $validated = $request->validate([
                'password' => 'required|string|min:8|confirmed',
            ]);

            $authService->changePasswordService($validated, $jwt->familyIdFromToken($request->bearerToken()));

            return response()->json([
                'success' => true,
                'message' => 'Password has been reset successfully.'
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Failed to reset password.',
            ], 500);
        }
    }

    /**
     * Admin side Password reset
     *
     * Reset the user's password via admin. That user is logged out on every device.
     *
     * @authenticated
     */
    public function adminSidePasswordReset(Request $request, AuthService $authService, $userId)
    {
        try {
            $authService->adminSidePasswordResestService($userId);

            return response()->json([
                'success' => true,
                'message' => 'Password has been reset successfully.'
            ], 200);

        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Failed to reset password.',
            ], 500);
        }
    }

    /**
     * Authenticated User Details Retrieval
     *
     * Retrieve the authenticated user's details for the front end
     *
     * @authenticated
     */
    public function me(Request $request)
    {
        try {
            $user = auth()->user();

            return response()->json([
                'success' => true,
                'message' => 'User retrieved successfully.',
                'user' => MeResource::make($user),
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => config('app.debug') ? $e->getMessage() : 'Failed to retrieve user.',
            ], 500);
        }
    }

    // ==================================================================
    // Cookie helpers
    // ==================================================================

    private function cookieConf(): array
    {
        $conf = (array) config('auth.refresh_cookie', []);

        return [
            'name' => $conf['name'] ?? 'refresh_token',
            'path' => $conf['path'] ?? '/api/v1/auth',              // sent ONLY to the auth endpoints
            'domain' => ($conf['domain'] ?? null) ?: null,
            'secure' => $conf['secure'] ?? !config('app.debug'),   // HTTPS only (off in debug for local http)
            'same_site' => $conf['same_site'] ?? Cookie::SAMESITE_STRICT,
        ];
    }

    private function setRefreshCookie(JsonResponse $response, IssuedTokens $tokens): JsonResponse
    {
        $conf = $this->cookieConf();

        $response->headers->setCookie(Cookie::create(
            $conf['name'],
            $tokens->refresh,
            $tokens->refreshExpiresAt,   // cookie dies exactly when the row does
            $conf['path'],
            $conf['domain'],
            (bool) $conf['secure'],
            true,                        // httpOnly: JavaScript can never read it
            false,
            $conf['same_site'],
        ));

        return $this->noStore($response);
    }

    private function clearRefreshCookie(JsonResponse $response): JsonResponse
    {
        $conf = $this->cookieConf();

        $response->headers->setCookie(Cookie::create(
            $conf['name'], '', 1, $conf['path'], $conf['domain'], (bool) $conf['secure'], true, false, $conf['same_site'],
        ));

        return $this->noStore($response);
    }

    /** Token responses must never be cached by browsers or proxies (RFC 6749 5.1). */
    private function noStore(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }

    /**
     * Error envelope. 401s carry WWW-Authenticate: the frontend relies on
     * 401 = "session over".
     */
    private function error(string $message, string $code, int $status, bool $authenticate = false): JsonResponse
    {
        $response = response()->json([
            'success' => false,
            'message' => $message,
            'code' => $code,
        ], $status);

        if ($authenticate) {
            $response->headers->set('WWW-Authenticate', 'Bearer realm="api"');
        }

        return $this->noStore($response);
    }
}
```


## 9. Routes

**`routes/v1/modules/authentication.php`**

```php
<?php

use App\Http\Controllers\API\v1\modules\AuthController;
use App\Http\Middleware\TrustedOriginMiddleware;
use Illuminate\Support\Facades\Route;
use App\Constants\UserRoles;

// All under /api/v1/auth, which is also the refresh cookie's Path.

Route::prefix('v1/auth')->controller(AuthController::class)->group( function () {

    // Cookie-authenticated endpoints: CSRF-protected by the Origin check.
    Route::middleware([TrustedOriginMiddleware::class])->group(function () {
        Route::post('/login', 'login')->middleware('throttle:10,1');
        Route::post('/token/refresh', 'refreshToken')->middleware('throttle:60,1');
        Route::post('/logout', 'logout');
    });

    Route::middleware(['auth:api'])->group(function () {
        Route::post('/logout-all', 'logoutAll');
        Route::get('/sessions', 'viewSessions');
        Route::delete('/sessions/{familyId}', 'revokeSession')->whereUuid('familyId');

        Route::post('change-password', 'changePassword');
        Route::middleware(["role:" . UserRoles::roles(UserRoles::ADMINISTRATOR, UserRoles::STAFF)])
            ->put('/password-reset/{userId}', 'adminSidePasswordReset');
        Route::get('/me', 'me');
    });
});
```


## 10. Housekeeping

**`app/Console/Commands/PurgeRefreshSessions.php`**

```php
<?php

namespace App\Console\Commands;

use App\Services\v1\modules\RefreshTokenService;
use Illuminate\Console\Command;

/**
 * Schedule in routes/console.php:
 *   Schedule::command('auth:purge-refresh-sessions')->daily();
 */
class PurgeRefreshSessions extends Command
{
    protected $signature = 'auth:purge-refresh-sessions {--days=7 : Delete rows that expired more than this many days ago}';

    protected $description = 'Delete expired refresh-session rows';

    public function handle(RefreshTokenService $refreshTokens): int
    {
        $deleted = $refreshTokens->purgeExpired((int) $this->option('days'));

        $this->info("Purged {$deleted} refresh-session row(s).");

        return self::SUCCESS;
    }
}
```

Schedule it in `routes/console.php`:

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('auth:purge-refresh-sessions')->daily();
```

```bash
php artisan migrate
```

## Check it works

Create `auth.http` at the project root and run the requests in order with the VS Code REST Client (it keeps cookies between requests):

```http
@base = http://127.0.0.1:8000/api/v1

### 1. Login: 200, data.access, Set-Cookie refresh_token
# @name login
POST {{base}}/auth/login
Content-Type: application/json
Accept: application/json
X-Requested-With: XMLHttpRequest

{ "email": "admin@email.com", "password": "admin" }

###
@token = {{login.response.body.data.access}}

### 2. Me: 200 with the access token
GET {{base}}/auth/me
Authorization: Bearer {{token}}
Accept: application/json

### 3. Refresh: 200, a new access token and a new cookie
POST {{base}}/auth/token/refresh?include_user=1
Accept: application/json
X-Requested-With: XMLHttpRequest

### 4. Active sessions
GET {{base}}/auth/sessions
Authorization: Bearer {{token}}
Accept: application/json

### 5. Logout: 200, the cookie is cleared
POST {{base}}/auth/logout
Accept: application/json
X-Requested-With: XMLHttpRequest

### 6. The old access token no longer works: 401
GET {{base}}/auth/me
Authorization: Bearer {{token}}
Accept: application/json
```

Also try: a wrong password (401 `invalid_credentials`), a login without `X-Requested-With` or `Origin` (403), and refresh after logout (401 `refresh_revoked`).

The full behaviour, error codes and the frontend recipe: [Authentication](/architecture/authentication).

Next: [10 · Permissions (RBAC)](/foundations/10-rbac)
