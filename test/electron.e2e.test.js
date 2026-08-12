const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { _electron: playwrightElectron } = require("playwright");

// Smoke E2E: boots the actual Electron binary and verifies the main process registers handlers.
test("Electron starts the application and registers IPC handlers", async () => {
  const electron = require("electron");
  await new Promise((resolve, reject) => {
    const child = spawn(electron, ["."], {
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Electron did not become ready. Output: ${output}`));
    }, 15000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("Handlers IPC registrados correctamente")) {
        clearTimeout(timeout);
        child.kill();
        resolve();
      }
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  assert.ok(true);
});

// Playwright controls the actual Electron window and validates a user interaction.
test("Electron UI opens and closes account settings", async () => {
  const app = await playwrightElectron.launch({
    args: ["."],
    cwd: path.join(__dirname, ".."),
  });
  try {
    const page = await app.firstWindow();
    await page.locator("#userBadge").waitFor();
    assert.equal(await page.locator(".logo").textContent(), "openapi-client");
    await page.locator("#userBadge").click();
    await page.locator("#userModalBackdrop").waitFor({ state: "visible" });
    await page.locator("#userModalCancelBtn").click();
    await page.locator("#userModalBackdrop").waitFor({ state: "hidden" });
  } finally {
    await app.close();
  }
});
