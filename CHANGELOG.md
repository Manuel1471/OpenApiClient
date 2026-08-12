# Changelog

All notable changes to OpenAPI Client are documented in this file.

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

### Fixed

- Corrected the collection creation IPC channel mismatch in the preload bridge.
- Exposed collection updates safely to the renderer.
- Preserved new preferences such as language, history, environments, and authentication during configuration migration.
