# OpenAPI Client

**OpenAPI Client** is a desktop API workspace for developers who want to build, inspect, test, document, and share API requests without leaving a focused terminal-inspired interface.

Version **1.1.0** supports REST/HTTP, GraphQL, WebSocket, SOAP, and unary gRPC workflows. Collections stay local by default, can be stored next to source code, and can be synchronized through your existing Git setup.

## Highlights

- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.
- Protocol workspaces for HTTP, GraphQL, WebSocket, SOAP, and unary gRPC.
- Collections, folders, requests, search, import/export, documentation, and native Git actions.
- Environments plus global variables such as `{{baseUrl}}` and `{{token}}`.
- Request validation, response inspection, JSON formatting, diff, Timeline, history, cancellation, and configurable timeouts.
- Form-data with multiple file attachments and custom MIME types.
- Assertions, response chaining, rate-limit testing, a Collection Runner, and a CLI suitable for CI/CD.
- Interface available in Spanish, English, French, and German.

## Requirements

- Node.js 26 or later
- npm 11 or later

The repository includes `.nvmrc`. If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` before installing dependencies.

## Install and run

```bash
git clone https://github.com/Manuel1471/OpenApiClient.git
cd OpenApiClient
nvm use
npm install
npm start
```

For development mode:

```bash
npm run dev
```

## Core workflows

### Send a request

1. Create a request or select one from a collection.
2. Select an environment and protocol.
3. Configure the URL, query parameters, headers, body, authentication, and optional assertions.
4. Press **Send** or use `Cmd/Ctrl + Enter`.
5. Inspect Body, Headers, Diff, and Timeline in the response panel.

Use `Cmd/Ctrl + S` to save the active request. The interface marks unsaved changes before you lose them.

### Supported protocols

| Protocol | Included workflow |
| --- | --- |
| HTTP / REST | URL, query params, headers, raw bodies, form-data, URL-encoded bodies, and authentication |
| GraphQL | Query or mutation editor with JSON variables; sent as a POST JSON request |
| WebSocket | Connect, disconnect, send messages, and inspect an in-app message log |
| SOAP | XML envelope editor and standard request headers |
| gRPC | Unary request calls from a selected `.proto` file, service, method, and JSON payload |

### Variables and environments

Use `{{variableName}}` anywhere a value is accepted. Open **Account settings → Environments** to manage environment-specific variables and **Advanced** for global variables.

Default environments are Local, Staging, and Production. The active environment is shown in the request bar. Sensitive values are stored through Electron `safeStorage` when the operating-system keychain is available.

### Collections, folders, and documentation

Collections can be created, imported, renamed, exported, detached, and organized into folders. Requests can be renamed, duplicated, moved between collections, deleted, and replayed from history.

Use the documentation action on a collection or folder to generate a Markdown API reference. It includes an overview, contents, endpoints, query parameters, headers, form-data, bodies, auth type, and saved assertions. The generated document uses the current application language and redacts likely secret values, credentials, tokens, API keys, and sensitive headers.

### Response tools and Timeline

Each HTTP run exposes status, latency, response size, body, and headers. The **Timeline** tab records the resolved request, response, and network outcome in chronological entries. It keeps a bounded in-memory list and redacts sensitive request data.

Large payloads are protected from expensive syntax highlighting and visual diff work. The view displays a preview, while **Copy** still copies the complete response body.

### Testing and Collection Runner

The **Testing** tab supports:

- Expected HTTP status and required-header assertions.
- JSON-path checks with `exists`, `equals`, and `contains` operators.
- Saving a response value as an environment variable for a subsequent request.
- Controlled burst tests with request count, concurrency, average duration, status distribution, and HTTP `429` visibility.

Use the `▶` action on a collection to open the **Collection Runner**. It runs saved requests sequentially, applies their status/header assertions, shows per-request results, and downloads a localized Markdown report.

## CLI and CI/CD

Run a saved collection from the terminal:

```bash
npm run run:collection -- path/to/collection.json --lang en
```

The CLI accepts `en`, `es`, `fr`, or `de`. It exits with code `1` when a request fails or a saved status/header assertion does not pass, which makes it suitable for CI/CD pipelines.

Variables are resolved from the process environment:

```bash
baseUrl=https://api.example.com token="$API_TOKEN" \
  npm run run:collection -- collections/users.json --lang en
```

Minimal GitHub Actions example:

```yaml
- run: npm ci
- run: baseUrl=https://api.example.com npm run run:collection -- collections/smoke.json --lang en
```

## Git collaboration

Open **Account settings → Git** to choose a local repository and inspect its branch, status, and recent history. The UI provides initialize, commit, fetch, pull (`--ff-only`), and push actions.

Authentication is delegated to the Git credentials already configured on the machine, such as SSH keys, Git Credential Manager, macOS Keychain, or another system credential helper. OpenAPI Client does not store Git tokens.

## Privacy and security

- Collections and configuration remain local unless you explicitly export, synchronize, or commit them.
- Portable collection exports redact Basic Auth passwords, API keys, Bearer tokens, and sensitive headers.
- Documentation and Timeline redact common secret names and credential headers.
- Never commit real secrets to a repository. Prefer environment variables or your CI provider’s secret store.

## Project structure

```text
main/                 Electron main process and IPC handlers
main/handlers/        Files, collections, requests, protocols, and Git handlers
renderer/             User interface, components, styles, and translations
renderer/preload/     Secure context bridge for renderer IPC access
src/services/         Collection and configuration services
scripts/              CLI utilities for local and CI execution
test/                 Unit and Electron smoke tests
```

## Development commands

| Command | Purpose |
| --- | --- |
| `npm start` | Run the Electron app |
| `npm run dev` | Run in development mode |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run Electron startup and settings smoke tests |
| `npm run run:collection -- <file> --lang en` | Execute a collection from the terminal |
| `npm run dist` | Build with electron-builder |
| `npm run dist:mac` | Build a macOS DMG |
| `npm run dist:win` | Build a Windows NSIS installer |
| `npm run dist:linux` | Build a Linux AppImage |
| `npm run dist:mac:x64` | Build a macOS Intel DMG |
| `npm run dist:mac:arm64` | Build a macOS Apple Silicon DMG |
| `npm run dist:win:x64` | Build a Windows x64 NSIS installer |
| `npm run dist:linux:x64` | Build a Linux x64 AppImage |
| `npm run dist:release` | Build all four distributable artifacts sequentially |

### Release artifacts

Run the following command to produce the complete v1.1.0 release set:

```bash
npm run dist:release
```

Artifacts are created in `dist/` with platform and architecture in the filename, for example:

```text
OpenAPI-Client-1.1.0-mac-x64.dmg
OpenAPI-Client-1.1.0-mac-arm64.dmg
OpenAPI-Client-1.1.0-win-x64.exe
OpenAPI-Client-1.1.0-linux-x64.AppImage
```

## Release notes

See [CHANGELOG.md](CHANGELOG.md) for the complete version history. The current release is **1.1.0**.

## License

[MIT](LICENSE)
