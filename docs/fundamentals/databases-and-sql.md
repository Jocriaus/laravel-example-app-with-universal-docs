# Databases & SQL

A **relational database** stores data in **tables** made of **rows** (records) and **columns** (fields). MySQL is the one used in these docs.

```
campuses
┌────┬──────┬──────────────┬───────────┬─────────────────────┐
│ id │ code │ name         │ is_active │ deleted_at          │
├────┼──────┼──────────────┼───────────┼─────────────────────┤
│  1 │ MAIN │ Main Campus  │ 1         │ NULL                │
│  2 │ NRTH │ North Campus │ 0         │ 2026-09-01 08:00:00 │
└────┴──────┴──────────────┴───────────┴─────────────────────┘
```

## Keys and relationships

- **Primary key (PK):** a column that uniquely identifies a row, usually `id` (auto-increment).
- **Foreign key (FK):** a column that points to another table's PK, e.g. `colleges.campus_id → campuses.id`. The database refuses rows that point nowhere.
- **Unique constraint:** no two rows may share the value (e.g. `users.email`).

| Relationship | Example | How it's stored |
|---|---|---|
| One-to-many | a campus has many colleges | `colleges.campus_id` |
| Many-to-one | a user belongs to a role | `users.user_role_id` |
| Many-to-many | users ↔ user groups | a **pivot** table `user_group_members (user_id, user_group_id)` |
| One-to-one | a user has one signature file | `users.signature_id` |

## SQL in five statements

```sql
-- Read
SELECT id, name FROM campuses WHERE is_active = 1 ORDER BY name LIMIT 10 OFFSET 0;

-- Create
INSERT INTO campuses (code, name, is_active) VALUES ('MAIN', 'Main Campus', 1);

-- Update
UPDATE campuses SET name = 'Main' WHERE id = 1;

-- Delete
DELETE FROM campuses WHERE id = 1;

-- Combine tables
SELECT c.name, COUNT(col.id) AS colleges
FROM campuses c
LEFT JOIN colleges col ON col.campus_id = c.id
GROUP BY c.id, c.name;
```

In Laravel you will mostly write the same thing with **Eloquent**:

```php
Campus::where('is_active', true)->orderBy('name')->paginate(10);
Campus::create(['code' => 'MAIN', 'name' => 'Main Campus']);
Campus::withCount('colleges')->get();
```

Eloquent builds safe SQL for you. See [Eloquent](/laravel-basics/eloquent).

## Migrations: the schema as code

Instead of clicking tables together in a database tool, you describe them in **migration** files that are committed to Git. Everyone runs the same migrations and gets the same schema:

```bash
php artisan make:migration create_campuses_table
php artisan migrate            # apply new migrations
php artisan migrate:rollback   # undo the last batch
php artisan migrate:fresh --seed   # drop everything, rebuild, seed (local only!)
```

## Indexes

An **index** is a lookup structure that makes `WHERE`, `ORDER BY` and `JOIN` on a column fast. Primary keys, foreign keys and unique columns get one automatically. Add your own for columns you filter or sort by often:

```php
$table->index('expires_at');
$table->index(['user_id', 'revoked_at']);   // composite: filter by user_id, then revoked_at
```

## Soft deletes

Many records should not really disappear (audits, restoring mistakes). A **soft delete** fills a `deleted_at` column instead of removing the row; Eloquent then hides those rows automatically. See [Eloquent](/laravel-basics/eloquent#soft-deletes).

## Transactions

A **transaction** groups several writes so they all succeed or all fail. If the second insert fails, the first one is undone. See [Transactions](/laravel-basics/transactions).

## Column types you will use

| Laravel | MySQL | Use for |
|---|---|---|
| `id()` | `BIGINT UNSIGNED AUTO_INCREMENT` | primary key |
| `foreignId('campus_id')->constrained()` | `BIGINT UNSIGNED` + FK | relationships |
| `string('name', 150)` | `VARCHAR(150)` | short text |
| `text('description')` | `TEXT` | long text |
| `boolean('is_active')` | `TINYINT(1)` | yes/no |
| `integer`, `decimal('amount', 10, 2)` | `INT`, `DECIMAL` | numbers, money (never `float` for money) |
| `dateTime('expires_at')` | `DATETIME` | a point in time |
| `timestamps()` | two nullable `TIMESTAMP` | `created_at`, `updated_at` |
| `uuid('family_id')` | `CHAR(36)` | random public ids |
| `json('settings')` | `JSON` | small structured data |

::: warning Required time columns on MySQL
Use `dateTime()` for **required** time columns. Some MySQL servers give a `NOT NULL TIMESTAMP` an invalid default, or silently update the first one on every change. `timestamps()` and `softDeletes()` are nullable, so they are fine.
:::

Next: [RESTful APIs](/fundamentals/restful-apis)
