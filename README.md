# OpenAPI Client

**A desktop API client for building, organizing, testing, and debugging HTTP requests.**

OpenAPI Client provides a clean, terminal-inspired workspace for interacting with APIs without leaving your desktop. Create reusable request collections, manage environments, configure authentication, inspect responses, and run controlled endpoint burst tests from a single application.

> Current release: **v1.0.0**

---

## ✨ Features

### HTTP Requests

* Support for `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`
* Query parameter management
* Custom request headers
* Configurable request timeouts
* Automatic response metadata

### Request Bodies

Send requests using:

* JSON
* Plain text
* XML
* `multipart/form-data`
* `application/x-www-form-urlencoded`

### Authentication

Built-in support for:

* Bearer tokens
* Basic authentication
* API keys

### Collections

Organize requests into reusable collections.

* Create collections
* Rename collections
* Import and export collections
* Save request configurations
* Reuse requests across development sessions

### Environments & Variables

Create reusable environments for development, staging, production, or any custom setup.

```text
{{baseUrl}}
{{token}}
{{userId}}
```

Variables can be reused across requests, making it easy to switch between different API environments.

### Response Inspector

Inspect everything you need when debugging an API:

* HTTP status code
* Response body
* Response headers
* Request latency
* Payload size

### Endpoint Burst Testing

Run controlled bursts of requests against an endpoint to quickly inspect:

* Status code distribution
* Failed requests
* Response behavior
* Rate limits
* Basic endpoint stability

This feature is intended for development and controlled testing environments.

---

## 🔐 Local Data & Security

OpenAPI Client stores its configuration locally using Electron's application data directory.

Environment tokens and sensitive values are encrypted using Electron's native `safeStorage` API whenever an operating-system keychain is available.

This keeps local credentials protected without requiring an external account or cloud service.

---

## 🚀 Getting Started

### Requirements

* Node.js **26+**
* npm **11+**

The repository includes an `.nvmrc` file, so if you use `nvm` you can automatically select the expected Node.js version.

### Installation

```bash
git clone https://github.com/Manuel1471/OpenApiClient.git
cd OpenApiClient

nvm use
npm install
npm start
```

---

## 🛠 Development

Start the application in development mode:

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

---

## 🏗 Project Structure

```text
OpenApiClient/
├── main/       # Electron main process and IPC handlers
├── renderer/   # User interface and HTML components
├── src/        # Application services and configuration
└── ...
```

The application separates the Electron runtime, renderer interface, and application services to keep responsibilities isolated and the codebase maintainable.

---

## 🧪 Testing

OpenAPI Client includes automated testing for application behavior and end-to-end workflows.

```bash
# Unit / integration tests
npm test

# End-to-end tests
npm run test:e2e
```

---

## 🗺 Roadmap

OpenAPI Client is actively evolving. Potential future improvements include:

* OpenAPI specification import
* Request history
* Collection-level authentication
* Pre-request scripts
* Response validation
* Improved environment management
* Extended testing tools
* Additional collection import/export formats

---
## 📥 Download

You don't need to clone the repository or install Node.js to use OpenAPI Client.

Every GitHub release includes a **ready-to-use installer**, allowing you to download and install the latest version directly.

1. Go to the **Releases** section.
2. Select the latest version.
3. Download the installer for your platform.
4. Install and launch OpenAPI Client.

> Installers are provided with every release.

---

## 📦 Releases

Every OpenAPI Client release includes:

* A ready-to-use application installer
* Version-specific release notes
* Bug fixes and improvements
* New features introduced in that version

The complete version history is also documented in `CHANGELOG.md`.

Developers who want to run or modify the application from source can follow the instructions below.


---

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome.

If you'd like to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Add or update tests when appropriate.
5. Submit a pull request.

For larger changes, consider opening an issue first to discuss the proposed implementation.

---

## 📄 License

OpenAPI Client is released under the **MIT License**.

See `LICENSE` for details.

---

## 👤 Author

Created and maintained by **Manuel Garcia**.

GitHub: `@Manuel1471`
