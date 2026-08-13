# Changelog

All notable changes to OpenAPI Client are documented in this file.

## [1.1.0] - 2026-08-12

### Added

- Protocol workspace for GraphQL, WebSocket, SOAP, and unary gRPC requests.
- GraphQL query/mutation editor with JSON variables and HTTP POST execution.
- WebSocket connection lifecycle, send/receive support, and in-app message log.
- SOAP XML envelope editor and gRPC unary calls from `.proto` files using service, method, and JSON payload fields.
- Dedicated Git settings tab with repository selection, current branch, status, recent history, initialize, commit, fetch, pull (`--ff-only`), and push actions.
- Collection documentation export for collections and folders, with overview, contents, endpoint detail, parameters, headers, form-data, request bodies, authentication type, and assertions.
- Localized documentation exports that follow the selected application language.
- Sensitive-value redaction in portable exports, generated documentation, and Timeline entries.
- Response Timeline with request, response, and network filters; resolved request details; response metadata; and bounded in-memory history.
- Collection Runner from the collection action menu, including sequential execution, delay controls, status/header assertion results, localized summary, and Markdown test report export.
- `npm run run:collection` CLI command for collection execution in CI/CD, environment-variable interpolation, selectable output language, and non-zero exit status on failures.
- Multiple form-data file attachments, individual MIME type fields, and native file selection.
- Global and environment variable editors with masked values and visibility controls.
- Response preview limits, Timeline body limits, and large-payload diff protection to keep the interface responsive.
- Parallel loading of saved collections, debounced collection search, and UI yielding during collection runs.
- Full request-area scrolling for long Testing, Timeline, and response content in non-maximized windows.
- Expanded localized interface coverage across protocol controls, testing, Timeline, Git, variables, tooltips, accessibility labels, and dynamic feedback.

### Changed

- README rewritten as an English product, development, protocol, security, Git, testing, CI/CD, and distribution guide.
- Generated documentation is now structured as an API reference and uses the active application language instead of a fixed language.
- The response renderer preserves complete data for copy actions while limiting expensive rendering work for large payloads.

### Fixed

- Prevented long request-tab content from being hidden below the response panel.
- Preserved network error categories in Timeline and user feedback.
- Corrected mixed-language labels in recently added protocol, settings, testing, and response controls.

## [1.0.0] - 2026-08-12

### Added

- Electron desktop application for creating and running HTTP requests.
- Terminal-inspired interface, collection sidebar, and actionable empty states.
- Collection management: create, import, export, rename, detach from the app, load at startup, and expand requests.
- Request creation, saving, updating, renaming, duplication, deletion, and moving between collections.
- Unique request IDs to update the intended request even when names or URLs match.
- GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS methods.
- Editors for URLs, query parameters, headers, raw bodies, form-data, and URL-encoded form data.
- Bearer token, Basic, and API key request authentication.
- Response body and header panels, copy/clear actions, status codes, latency, payload size, timeout, and cancellation.
- HTTP execution in Electron's main process to avoid renderer CORS restrictions.
- JSON formatting, minification, and basic syntax highlighting for JSON responses.
- Persistent request history with one-click replay.
- Local, Staging, and Production environments with `{{baseUrl}}` and `{{token}}` variables, editable from the UI.
- Native encryption for persisted environment tokens through Electron `safeStorage` when available.
- Controlled endpoint burst testing for developers, including concurrency, average latency, status distribution, and HTTP 429 reporting.
- UI available from a single translation dictionary in Spanish, English, French, and German.
- Keyboard shortcuts: `Cmd/Ctrl + Enter` to send and `Cmd/Ctrl + S` to save.
- Configurable account preferences, language, environments, request timeout, and disabled future-login configuration.
- Node.js 26 and npm 11 requirements.
- Unit tests for collection persistence and translations, plus an Electron startup end-to-end smoke test.
- Version label shown consistently in the application shell and documentation.

### Fixed

- Corrected the collection creation IPC channel mismatch in the preload bridge.
- Exposed collection updates safely to the renderer.
- Preserved new preferences such as language, history, environments, and authentication during configuration migration.
