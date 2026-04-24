# @2byte/zip-archive

Cross-platform directory archiving and extraction with flexible ignore patterns.

Creates `.zip` archives on Windows (via PowerShell) and `.tar.gz` on Unix-like systems.  
Works on Node.js and Bun runtimes without any npm dependencies — uses only `node:` built-ins and OS-native tools.

## Install

```bash
bun add jsr:@2byte/zip-archive
```

Or import directly:

```ts
import { ZipArchive } from "jsr:@2byte/zip-archive";
```

## Quick start

```ts
import { ZipArchive, Logger } from "jsr:@2byte/zip-archive";

const logger = new Logger("./archive.log");

const zip = new ZipArchive({
  logger,
  ignores: ["dist", "logs", "*.log"],
});

const { data, extension } = zip.createArchiveFromDirectory("./my-project");
// extension is ".zip" on Windows, ".tar.gz" on Unix

Bun.write(`output${extension}`, data);
```

## API

### `new ZipArchive(options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `ignores` | `string[]` | `[]` | User-defined ignore patterns |
| `defaultIgnores` | `string[]` | `["node_modules", ".git", ".github", ".env"]` | Always-applied patterns merged with `ignores` |
| `logger` | `Logger` | `undefined` | Optional logger instance |

### Methods

| Method | Description |
|---|---|
| `createArchiveFromDirectory(dirPath)` | Archive a directory; returns `{ data: Buffer, extension }` |
| `extractArchive(filename, data, extractPath)` | Extract ZIP or tar.gz into a directory |
| `setIgnores(patterns)` | Replace user ignore list |
| `addIgnores(patterns)` | Append to user ignore list |
| `setDefaultIgnores(patterns)` | Replace default ignore list |
| `addDefaultIgnores(patterns)` | Append to default ignore list |
| `getIgnores()` | Returns current user ignore list |
| `getDefaultIgnores()` | Returns current default ignore list |

---

## Ignore patterns

Patterns are matched against **relative paths** inside the archived directory.  
All path separators are normalised to `/` before matching.

### Pattern types

#### 1. Directory or file name — matches anywhere in the tree

```
node_modules      → matches any segment named "node_modules" at any depth
.env              → matches any file or directory named ".env"
```

#### 2. File mask with `*` wildcard — matches basename only

```
*.log             → any file ending in .log
*.tmp             → any .tmp file
.env*             → .env, .env.local, .env.production, …
```

#### 3. Path-based pattern — matches only at that exact relative path

```
notify/node_modules     → only the node_modules inside notify/, NOT root-level node_modules
dist/logs               → only logs/ inside dist/
```

Use path-based patterns when you want surgical control: the same name somewhere else in the tree is **not** affected.

#### 4. Double-star glob `**` — matches across path boundaries

```
**/fixtures/**    → any path containing fixtures/
src/**/*.test.ts  → all .test.ts files anywhere under src/
```

### Quick reference

| Pattern | What it ignores |
|---|---|
| `node_modules` | Any `node_modules` directory at any depth |
| `*.log` | Any file ending in `.log` |
| `.env*` | `.env`, `.env.local`, `.env.production`, … |
| `dist` | Any directory named `dist` at any depth |
| `notify/node_modules` | Only `node_modules` inside the top-level `notify/` directory |
| `src/fixtures` | Only the `fixtures` directory inside `src/` |
| `**/snapshots/**` | Any path that contains `snapshots/` as a segment |
| `build/*.map` | `.map` files directly inside `build/` |

### Rules and edge cases

- **Trailing slashes are stripped** before matching. Write `dist`, not `dist/`.
- **Leading `./` is stripped** before matching. Write `src/foo`, not `./src/foo`.
- A name-only pattern (no `/`, no glob) matches as a **directory segment** when the entry is a directory, or as a **basename** when the entry is a file.
- A path-based pattern matches when `relativePath === pattern` **or** `relativePath.startsWith(pattern + "/")`.

### Example config

```ts
const zip = new ZipArchive({
  ignores: [
    // name-only: all node_modules anywhere
    "node_modules",
    // path-based: only in notify/
    "notify/node_modules",
    // file masks
    "*.log",
    "*.exe",
    "*.map",
    // specific paths
    "dist",
    "coverage",
  ],
});
```

---

## Platform behaviour

| Platform | Archive format | Tool used |
|---|---|---|
| Windows | `.zip` | `powershell.exe` — `Compress-Archive` |
| Linux / macOS | `.tar.gz` | `tar` (GNU/BSD) |

Extraction mirrors this: `.zip` uses `Expand-Archive` on Windows and `unzip`/`tar` on Unix; `.tar.gz` always uses `tar`.

---

## Logger

The package re-exports a simple `Logger` class for file + console output.

```ts
import { Logger } from "jsr:@2byte/zip-archive";

// write to file, also print to console
const logger = new Logger("./logs/archive.log");

// silent — write to file only
const silent = new Logger("./logs/archive.log", true);

// no file output, console only
const consoleOnly = new Logger("./logs/archive.log", false, false);
```

### Logger constructor

```ts
new Logger(logFile: string, silentMode?: boolean, writeLogToFileEnabled?: boolean)
```

---

## Publishing

```bash
cd packages/zip-archive
bunx jsr publish
```
