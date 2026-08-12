// Ejecución HTTP en el proceso principal para evitar restricciones CORS del renderer.
const { ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
// Keeps active requests addressable so the renderer can cancel long-running calls.
const controllers = new Map();

ipcMain.handle("execute-request", async (event, request) => {
  const startedAt = Date.now();
  const controller = new AbortController();
  controllers.set(request.id, controller);
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1000, Number(request.timeout) || 30000),
  );
  try {
    const body = request.formData
      ? await createFormData(request.formData)
      : request.body;
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
      size: Buffer.byteLength(text, "utf8"),
      duration: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
    controllers.delete(request.id);
  }
});

async function createFormData(entries) {
  const form = new FormData();
  for (const entry of entries) {
    if (entry.filePath)
      form.append(
        entry.key,
        new Blob([await fs.readFile(entry.filePath)]),
        path.basename(entry.filePath),
      );
    else form.append(entry.key, entry.value || "");
  }
  return form;
}

ipcMain.handle("cancel-request", async (event, requestId) => {
  const controller = controllers.get(requestId);
  if (!controller) return { success: false };
  controller.abort();
  return { success: true };
});

module.exports = {};
