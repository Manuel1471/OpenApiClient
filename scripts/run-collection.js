#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");

const [file, ...options] = process.argv.slice(2);
const language = options.includes("--lang") ? options[options.indexOf("--lang") + 1] : "en";
const messages = {
  en: { usage: "Usage: npm run run:collection -- <collection.json> [--lang en|es|fr|de]", running: "Running", passed: "passed", failed: "failed", complete: "Complete" },
  es: { usage: "Uso: npm run run:collection -- <coleccion.json> [--lang en|es|fr|de]", running: "Ejecutando", passed: "correctas", failed: "fallidas", complete: "Completado" },
  fr: { usage: "Utilisation : npm run run:collection -- <collection.json> [--lang en|es|fr|de]", running: "Exécution", passed: "réussies", failed: "échouées", complete: "Terminé" },
  de: { usage: "Verwendung: npm run run:collection -- <sammlung.json> [--lang en|es|fr|de]", running: "Ausführung", passed: "bestanden", failed: "fehlgeschlagen", complete: "Abgeschlossen" },
}[language] || null;

if (!file || !messages) {
  console.error(messages?.usage || "Invalid language. Use en, es, fr, or de.");
  process.exit(2);
}

const interpolate = (value) => String(value || "").replace(/{{\s*([^}]+)\s*}}/g, (_, name) => process.env[name] ?? `{{${name}}}`);
const run = async () => {
  const collection = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
  const requests = collection.requests || [];
  let failures = 0;
  console.log(`${messages.running} ${collection.info?.name || path.basename(file)} (${requests.length})`);
  for (const request of requests) {
    try {
      const url = new URL(interpolate(request.url));
      for (const { key, value } of request.params || []) if (key) url.searchParams.set(key, interpolate(value));
      const headerEntries = Array.isArray(request.headers)
        ? request.headers.filter(({ key }) => key).map(({ key, value }) => [key, interpolate(value)])
        : Object.entries(request.headers || {}).map(([key, value]) => [key, interpolate(value)]);
      const headers = Object.fromEntries(headerEntries);
      if (request.auth?.type === "bearer") headers.Authorization = `Bearer ${interpolate(request.auth.token)}`;
      if (request.auth?.type === "apikey") headers[request.auth.keyName || "X-API-Key"] = interpolate(request.auth.token);
      const response = await fetch(url, { method: request.method || "GET", headers, body: request.body?.type && request.body.type !== "none" ? request.body.content : undefined });
      const headerRequired = request.tests?.header;
      const statusOk = !request.tests?.expectedStatus || Number(request.tests.expectedStatus) === response.status;
      const headerOk = !headerRequired || response.headers.has(headerRequired);
      const passed = statusOk && headerOk;
      if (!passed) failures += 1;
      console.log(`${passed ? "✓" : "×"} ${request.method || "GET"} ${request.name || url.pathname} — ${response.status}`);
    } catch (error) {
      failures += 1;
      console.log(`× ${request.name || request.url} — ${error.message}`);
    }
  }
  console.log(`${messages.complete}: ${requests.length - failures} ${messages.passed}, ${failures} ${messages.failed}`);
  process.exitCode = failures ? 1 : 0;
};
run().catch((error) => { console.error(error.message); process.exit(1); });
