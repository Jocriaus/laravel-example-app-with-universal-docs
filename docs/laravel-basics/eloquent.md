# Eloquent: models & migrations

**Eloquent** is Laravel's ORM: one PHP class (a **model**) per table, one object per row.

## Create a model with its migration

```bash
php artisan make:model Campus -m
```

`-m` also creates `database/migrations/xxxx_create_campuses_table.php`:

```php
public function up(): void
{
    Schema::create('campuses', function (Blueprint $table) {
        $table->id();
        $table->string('code', 20)->unique();
        $table->string('name', 150);
        $table->string('address')->nullable();
        $table->boolean('is_active')->default(true);
        $table->timestamps();      // created_at, updated_at
        $table->softDeletes();     // deleted_at
    });
}
```

```bash
php artisan migrate
```

## The model

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Campus extends Model
{
    use SoftDeletes;

    // Table name is guessed from the class: Campus -> campuses.
    // protected $table = 'campuses';

    /** Columns that create()/fill()/update() may set. Everything else is ignored. */
    protected $fillable = ['code', 'name', 'address', 'is_active'];

    /** Hidden from toArray()/JSON. */
    protected $hidden = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',     // 1/0 in the DB, true/false in PHP
        ];
    }

    public function colleges()
    {
        return $this->hasMany(College::class);
    }
}
```

## CRUD

```php
// Create
$campus = Campus::create(['code' => 'MAIN', 'name' => 'Main Campus']);

// Read
Campus::find(1);                 // or null
Campus::findOrFail(1);           // or ModelNotFoundException (-> 404)
Campus::where('is_active', true)->orderBy('name')->get();
Campus::where('code', 'MAIN')->first();
Campus::paginate(10);            // LengthAwarePaginator

// Update
$campus->fill(['name' => 'Main'])->save();
$campus->update(['name' => 'Main']);
$campus->isDirty();              // has unsaved changes?
$campus->getChanges();           // what the last save() changed

// Delete
$campus->delete();
```

## Relationships

```php
class College extends Model
{
    public function campus() { return $this->belongsTo(Campus::class); }   // colleges.campus_id
}

class User extends Model
{
    public function groups() {                                            // many-to-many via pivot
        return $this->belongsToMany(UserGroup::class, 'user_group_members');
    }
}

$campus->colleges;                       // lazy: runs a query on first access
Campus::with('colleges')->get();         // eager: 2 queries total instead of 1 + N
Campus::withCount('colleges')->get();    // adds colleges_count
Campus::whereHas('colleges')->get();     // only campuses that have colleges
$user->groups()->sync([1, 3]);           // replace pivot rows
```

::: warning The N + 1 problem
Looping over 50 campuses and reading `$campus->colleges` runs 51 queries. Use `with('colleges')` whenever you know you'll read a relation in a loop.
:::

## Scopes

Reusable query pieces:

```php
public function scopeActive($query) { return $query->where('is_active', true); }

Campus::active()->get();
```

## Soft deletes

With the `SoftDeletes` trait, `delete()` fills `deleted_at` instead of removing the row, and normal queries skip those rows.

```php
$campus->delete();                  // soft delete
Campus::withTrashed()->find(1);     // include deleted
Campus::onlyTrashed()->get();       // only deleted
$campus->restore();
$campus->forceDelete();             // really delete
```

Remember to ignore deleted rows in unique rules: `Rule::unique('campuses', 'code')->whereNull('deleted_at')`.

## Model events

Run code when something happens to a model:

```php
protected static function booted(): void
{
    static::deleting(function (Campus $campus) {
        if ($campus->colleges()->exists()) {
            throw new InvalidException('Cannot delete a campus that still has colleges.');
        }
    });
}
```

## Check it works

```bash
php artisan tinker
> App\Models\Campus::create(['code' => 'MAIN', 'name' => 'Main Campus'])
> App\Models\Campus::count()
```

Next: [API resources](/laravel-basics/api-resources)
