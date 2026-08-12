# OpenAPI Client v1.0.0

OpenAPI Client is now ready for its first public release: a desktop API client with a terminal-inspired workflow for organizing, executing, and testing HTTP requests.

## Highlights

- Create, import, rename, export, organize, and detach collections.
- Create, save, duplicate, move, delete, and execute requests.
- Support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
- Query parameters, headers, JSON/text/XML bodies, URL-encoded bodies, and multipart form-data.
- Multiple file attachments in form-data with optional MIME types.
- Bearer token, Basic, and API key authentication.
- Environments and reusable global/environment variables using `{{variable}}` syntax.
- Native safe storage for persisted environment secrets when supported by the operating system.
- Response status, latency, payload size, headers, JSON formatting, syntax highlighting, comparison, history, cancellation, and configurable timeouts.
- Clear error categories for timeout, cancellation, DNS, TLS, and network failures.
- Persisted request assertions for status, headers, JSON paths, equality, and contains checks.
- Response chaining: store a response value as an environment variable for the next request.
- Controlled endpoint burst testing with concurrency, latency, status distribution, and HTTP 429 reporting.
- OpenAPI/Swagger import with query/header parameters, JSON schema examples, and declared security schemes.
- Terminal-inspired interface available in Spanish, English, French, and German.
- Keyboard shortcuts: `Cmd/Ctrl + Enter` to send and `Cmd/Ctrl + S` to save.
- Accessible dialogs, visible focus states, keyboard modal handling, and keyboard response-panel resizing.
- macOS, Windows, and Linux packaging configuration with app icons.

## Requirements

- Node.js 26+
- npm 11+

## Verification

The release was verified with:

```bash
npm test
npm run test:e2e
```

Both test suites pass for v1.0.0.

## Known follow-up work

- Broader click-by-click Electron E2E coverage for collection management, uploads, and language switching.
- Production signing/notarization validation on each distribution platform.
- More advanced visual JSON comparison and OpenAPI schema conversion.
