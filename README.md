# OpenAPI Client v1.0.0

Version 1.0.0 of the desktop client for exploring and executing HTTP requests. It lets you organize collections, configure parameters, headers, bodies, and authentication, and inspect responses from a terminal-inspired interface.

## Requirements

- Node.js 26 or later
- npm 11 or later

The project includes `.nvmrc`; with [nvm](https://github.com/nvm-sh/nvm), run `nvm use` from the project directory.

## Install and run

```bash
git clone https://github.com/Manuel1471/OpenApiClient.git
cd OpenApiClient
nvm use
npm install
npm start
```

To run in development mode:

```bash
npm run dev
```

## Features

- Create, import, export, rename, and save request collections.
- Run GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS requests.
- Configure query parameters, headers, and request bodies (JSON, text, XML, form-data, or URL-encoded form data).
- Use Bearer, Basic, or API key request authentication.
- Inspect response bodies, headers, status codes, latency, and payload size.
- Manage environments and reusable variables such as `{{baseUrl}}` and `{{token}}`.
- Run controlled endpoint burst tests to inspect response status distribution and rate limits.

## Project structure

```text
main/       Electron main process and IPC handlers
renderer/   User interface and HTML components
src/        Application services and configuration
```

Each user's configuration is stored in Electron's `OpenApiClient` application data directory. Environment tokens are encrypted with Electron's native `safeStorage` when the operating system keychain is available.

## Tests

```bash
npm test
npm run test:e2e
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the version history and feature list.
