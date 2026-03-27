# @2byte/bun-sqlite-model

Abstract base model for working with SQLite via `bun:sqlite`. Provides a static method pattern (Table Data Gateway) — no instances, just class methods.

## Install

```bash
bunx jsr add @2byte/bun-sqlite-model
```

## Usage

```ts
import { Model } from '@2byte/bun-sqlite-model';
import { Database } from 'bun:sqlite';

const db = new Database('app.db');

export interface IUser {
  id: number;
  name: string;
  email: string;
}

export class UserModel extends Model {
  protected static override tableName = 'users';

  static findById(id: number): IUser | null {
    this.resolveDb();
    return this.queryOne(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  static create(name: string, email: string): IUser {
    this.resolveDb();
    const { lastInsertRowid } = this.run(
      `INSERT INTO ${this.tableName} (name, email) VALUES (?, ?)`,
      [name, email],
    );
    return this.findById(Number(lastInsertRowid))!;
  }

  static all(): IUser[] {
    this.resolveDb();
    return this.query(`SELECT * FROM ${this.tableName}`);
  }
}

// Option 1: explicit injection
UserModel.setDatabase(db);

// Option 2: put db on globalThis — resolveDb() will pick it up automatically
globalThis.db = db;
```

## API

### `Model.setDatabase(db)`
Explicitly injects a `Database` instance into the model class.

### `Model.resolveDb()`
Lazily resolves the DB: returns `this.db` if already set, otherwise falls back to `globalThis.db`. Call this at the start of each public method to ensure the connection is available.

### Protected query helpers

| Method | Returns | Description |
|---|---|---|
| `query(sql, params?)` | `any[]` | `stmt.all()` — multiple rows |
| `queryOne(sql, params?)` | `any` | `stmt.get()` — single row or undefined |
| `run(sql, params?)` | `{ lastInsertRowid, changes }` | INSERT / UPDATE / DELETE |
| `execute(sql, params?)` | `void` | fire-and-forget run |
| `exists(whereSql, params?)` | `boolean` | `SELECT 1 ... LIMIT 1` |
| `transaction(callback)` | `T` | wraps callback in a Bun transaction |

### `protected static tableName: string`
Override in each subclass:
```ts
protected static override tableName = 'users';
```

---

## Migrations

```ts
import { Migration } from '@2byte/bun-sqlite-model';
import { Database } from 'bun:sqlite';

const db = new Database('app.db');
const migration = new Migration(db, './database/migrations');

// Run all pending migrations
migration.up();

// Roll back entire last batch
migration.down();

// Roll back only 1 migration from last batch
migration.down(1);

// Print status
migration.status();

// Scaffold a new migration file
Migration.create('create_users', './database/migrations');
// → creates: 001_create_users.sql
```

### Migration file format

Files are named `NNN_name.sql` (e.g. `001_create_users.sql`). Each file has `-- UP` and `-- DOWN` sections. Multiple statements per section are supported.

```sql
-- UP
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- DOWN
DROP TABLE IF EXISTS users;
```

## Project bootstrap

You can scaffold an `artisan.ts` entrypoint and initial project structure in one call.

```ts
import { bootstrapArtisanProject } from '@2byte/bun-sqlite-model';

const result = bootstrapArtisanProject({
  rootDir: process.cwd(),
  dbPath: './database/db.sqlite3',
  migrationsPath: './database/migrations',
  modelsPath: './models',
  artisanPath: './artisan.ts',
  createExampleModel: true,
  exampleModelName: 'Example',
});

console.log(result);
```

Generated files and directories:

- `database/migrations/`
- `database/db.sqlite3`
- `models/Example.ts` (optional)
- `artisan.ts`

Set `force: true` to overwrite existing `artisan.ts` and example model files.

