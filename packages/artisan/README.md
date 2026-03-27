# @2byte/artisan

Minimal command registry for Bun projects with plugin support.

## Install

```bash
bunx jsr add @2byte/artisan
```

## CLI

The package provides `2byte-artisan` CLI with `init` command for quick project scaffolding.

```bash
2byte-artisan init
```

Generated structure by default:

- `database/migrations/`
- `database/db.sqlite3`
- `models/Example.ts`
- `artisan.ts`

### Options

```bash
2byte-artisan init [options]

--root <path>             Project root directory (default: current directory)
--db <path>               SQLite file path (default: ./database/db.sqlite3)
--migrations <path>       Migrations directory (default: ./database/migrations)
--models <path>           Models directory (default: ./models)
--artisan <path>          Output artisan entry file (default: ./artisan.ts)
--example-model <name>    Example model class name (default: Example)
--no-example-model        Do not create models/Example.ts
--force                   Overwrite existing files
-h, --help                Show help
```

Example:

```bash
2byte-artisan init --root . --force
```

## Programmatic usage

```ts
import { initProject } from '@2byte/artisan';

const result = initProject({
  rootDir: process.cwd(),
  force: false,
});

console.log(result.created, result.skipped);
```

## Core API

```ts
import { Artisan } from '@2byte/artisan';

const artisan = new Artisan();
artisan.command('hello', () => console.log('Hello'));
await artisan.run();
```
