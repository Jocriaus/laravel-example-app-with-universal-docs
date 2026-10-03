# Service container

The **service container** builds objects for you. When a controller method asks for a `CampusService`, Laravel creates one (and whatever *it* needs) automatically.

```php
class CampusController extends Controller
{
    public function store(CampusRequest $request, CampusService $service)   // both built by the container
    {
        return $service->createCampusService($request->validated());
    }
}

class CampusService
{
    public function __construct(private readonly ActivityLogger $logger) {}  // also injected
}
```

This is **dependency injection**: a class receives what it needs instead of creating it. The benefits:

- Controllers don't know how services are built.
- Tests can swap in a fake: `$this->mock(CampusService::class, fn ($m) => $m->shouldReceive(...))`.
- One place decides how a class is made.

## When you need to configure it

Classes with only type-hinted dependencies need **no setup**. Bind things by hand in `AppServiceProvider::register()` when:

```php
// an interface -> a concrete class
$this->app->bind(PaymentGateway::class, PaynamicsGateway::class);

// one shared instance for the whole request
$this->app->singleton(JwtService::class);
```

## Where it happens automatically

Controller constructors and methods, middleware `handle()` parameters after the fixed ones, artisan command `handle()`, jobs, event listeners, and anything built with `app(SomeClass::class)`.

## Service providers

A **service provider** is where you register bindings (`register()`) and boot-time setup (`boot()`): macros, custom auth guards, gates. Providers are listed in `bootstrap/providers.php`. [JWT access tokens](/foundations/08-jwt-access-tokens) adds one to register a custom auth guard.

Next: [Config & environment](/laravel-basics/config-and-env)
