# 04 · make:service

**Why:** Laravel has generators for controllers, requests and resources, but not for services. Add one, so every service starts from the same template.

## The command

**`app/Console/Commands/MakeServiceCommand.php`**

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\GeneratorCommand;
use Symfony\Component\Console\Attribute\AsCommand;

/**
 * php artisan make:service v1/modules/CampusService
 *   -> app/Services/v1/modules/CampusService.php (namespace App\Services\v1\modules)
 */
#[AsCommand(name: 'make:service')]
class MakeServiceCommand extends GeneratorCommand
{
    protected $name = 'make:service';

    protected $description = 'Create a new service class';

    protected $type = 'Service';

    protected function getStub()
    {
        return base_path('stubs/service.stub');
    }

    protected function getDefaultNamespace($rootNamespace)
    {
        return $rootNamespace . '\Services';
    }
}
```

Laravel 11+ discovers commands in `app/Console/Commands` automatically.

## The template

Create the `stubs/` folder at the project root:

**`stubs/service.stub`**

```php
<?php

namespace {{ namespace }};

use App\Exceptions\InvalidException;
use App\Helpers\ActivityLogHelper;

class {{ class }}
{
    public function __construct()
    {
        // Inject other services here if needed.
    }

    /**
     * Business logic for one action. Receives validated data, returns
     * (object) ['success' => bool, 'message' => string] or data for the controller.
     */
    public function exampleService(array $data)
    {
        // 1. Load / query what you need (findOrFail -> 404 in the controller)
        // 2. Check business rules (throw new InvalidException('...') -> 400)
        // 3. Write (wrap multi-table writes in DB::transaction)
        // 4. ActivityLogHelper::log([...]) for every change

        return (object) [
            'success' => true,
            'message' => 'Done.',
        ];
    }
}
```

`GeneratorCommand` fills in the namespace and class name for you.

## Check it works

```bash
php artisan make:service v1/modules/ExampleService
```

creates `app/Services/v1/modules/ExampleService.php` with namespace `App\Services\v1\modules`. Delete it afterwards.

Next: [05 · Query traits](/foundations/05-query-traits)
