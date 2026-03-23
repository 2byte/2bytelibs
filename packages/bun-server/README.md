# @2byte/bun-server

A lightweight HTTP server wrapper for [Bun](https://bun.sh) with expressive routing, path parameters, and built-in response helpers.

## Install

```bash
# From JSR
bunx jsr add @2byte/bun-server
```

## Usage

```ts
import { BunServerWrapper } from '@2byte/bun-server';

const server = new BunServerWrapper({ port: 3000 });

server.get('/users/:id', (req, params) => {
  return server.jsonResponse({ id: params?.id });
});

server.post('/users', async (req) => {
  const body = await server.parseJson(req);
  return server.jsonResponse({ created: true, data: body }, 201);
});

server.start();
```

## API

### `new BunServerWrapper(options?)`

| Option | Type | Default |
|---|---|---|
| `port` | `number` | `3000` |
| `hostname` | `string` | `'localhost'` |

### Routing

- `server.get(path, handler)`
- `server.post(path, handler)`
- `server.put(path, handler)`
- `server.patch(path, handler)`
- `server.delete(path, handler)`

Path parameters (`:param`) are extracted and passed as the second argument to the handler.

### Response helpers

- `server.jsonResponse(data, status?)` — `Content-Type: application/json`
- `server.textResponse(text, status?)` — `Content-Type: text/plain`
- `server.htmlResponse(html, status?)` — `Content-Type: text/html`

### Request helpers

- `server.parseJson<T>(req)` — parses request body as JSON
- `server.parseFormData(req)` — parses request body as FormData
- `server.getQueryParams(req)` — returns `URLSearchParams`

### Lifecycle

- `server.start()` — starts the server
- `server.stop()` — stops the server
- `server.getServerInfo()` — returns `{ port, hostname, isRunning }`
