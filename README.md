# @2byte — JSR packages

Scoped packages published to [jsr.io/@2byte](https://jsr.io/@2byte).

## Packages

| Package | Description |
|---|---|
| [`@2byte/artisan`](./packages/artisan/) | Lightweight command runner with plugin support and project init CLI |
| [`@2byte/bun-server`](./packages/bun-server/) | Lightweight HTTP server wrapper for Bun |
| [`@2byte/bun-sqlite-model`](./packages/bun-sqlite-model/) | Abstract base model for SQLite via `bun:sqlite` |

## Publishing

```bash
# Publish a package (run from the package directory)
cd packages/bun-server
bunx jsr publish
```

## Development

Each package lives in `packages/<name>/` and follows the structure:

```
packages/<name>/
  src/           ← source files
  mod.ts         ← public entry point (re-exports)
  jsr.json       ← JSR package config (name, version, exports)
  README.md
```
