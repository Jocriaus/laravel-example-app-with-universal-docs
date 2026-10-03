# Transactions

When one operation writes to several tables, either **all** writes must happen or **none**.

```php
use Illuminate\Support\Facades\DB;

DB::transaction(function () use ($group, $userIds) {
    $group->users()->sync($userIds);       // write 1
    $group->touch();                       // write 2
});
// If anything throws inside, both writes are rolled back and the exception continues.
```

The closure's return value is returned by `DB::transaction()`:

```php
$changes = DB::transaction(fn () => $group->users()->sync($userIds));
```

## Locking rows

When two requests may update the same row at the same time (two browser tabs refreshing one token), lock it:

```php
DB::transaction(function () use ($hash) {
    $row = RefreshSession::where('token_hash', $hash)->lockForUpdate()->first();
    // other transactions asking for this row now wait until we commit
});
```

## A trap: throwing after a write you want to keep

Everything inside the closure is rolled back when it throws, including writes you meant to keep (for example revoking a stolen token *and then* rejecting the request). Record the failure, finish the transaction, then throw outside:

```php
$failure = null;

DB::transaction(function () use (&$failure) {
    // ... revoke rows ...
    $failure = new RefreshTokenException('refresh_reused');
});

if ($failure) {
    throw $failure;   // the revocation is already committed
}
```

[Refresh sessions](/foundations/09-refresh-sessions) uses exactly this.

## Where transactions belong

In **services**, around the business operation, not in controllers.

Next: [Blade templates](/laravel-basics/blade)
