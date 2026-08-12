/**
 * Punto de entrada del renderer.
 *
 * Organización: inicialización → configuración/estado → colecciones/editor →
 * ejecución HTTP → historial → modales/notificaciones → utilidades. Las
 * funciones se mantienen juntas temporalmente porque los componentes HTML se
 * cargan dinámicamente y comparten el mismo DOM.
 */
const state = {
  config: null,
  collections: [],
  activeCollectionPath: null,
  activeRequest: null,
  modalAction: null,
  activeExecutionId: null,
  isDirty: false,
};

document.addEventListener("DOMContentLoaded", async () => {
  state.config = normaliseConfig(await window.electronAPI.getConfig());
  await loadComponents();
  applyTranslations();
  bindInterface();
  renderEnvironmentOptions();
  renderHistory();
  await loadSavedCollections();
  updateWelcomeMessage(state.config);
});

// ── Configuración y estado ────────────────────────────────────────────────
function normaliseConfig(config) {
  const defaults = [
    {
      id: "local",
      name: "Local",
      variables: { baseUrl: "http://localhost:3000", token: "" },
    },
    { id: "staging", name: "Staging", variables: { baseUrl: "", token: "" } },
    {
      id: "production",
      name: "Producción",
      variables: { baseUrl: "", token: "" },
    },
  ];
  config = config || {};
  config.user ||= { name: "Usuario" };
  config.authentication ||= {
    enabled: false,
    provider: null,
    session: null,
  };
  config.collections ||= [];
  config.history ||= [];
  config.environments ||= defaults;
  config.activeEnvironmentId ||= config.environments[0].id;
  config.language = window.translations?.[config.language]
    ? config.language
    : "es";
  return config;
}

function t(key) {
  return window.translations?.[state.config?.language || "es"]?.[key] || key;
}

function applyTranslations() {
  document.documentElement.lang = state.config.language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
}

async function loadComponents() {
  for (const [component, target] of [
    ["TopBar", "topBarContainer"],
    ["Sidebar", "sidebarContainer"],
    ["RequestBar", "requestBarContainer"],
    ["RequestTabs", "requestTabsContainer"],
    ["TabContent", "tabContentContainer"],
    ["ResponseSection", "responseSectionContainer"],
  ]) {
    await ComponentLoader.loadComponentIntoElement(component, target);
  }
}

function bindInterface() {
  byId("collectionsMenuTrigger").addEventListener("click", (event) => {
    event.stopPropagation();
    byId("collectionsMenu").classList.toggle("show");
  });
  document.addEventListener("click", () =>
    byId("collectionsMenu")?.classList.remove("show"),
  );
  byId("importFileBtn").addEventListener("click", handleImportFile);
  byId("userBadge").addEventListener("click", openUserWindow);
  byId("newCollectionBtn").addEventListener("click", () =>
    openCollectionDialog(),
  );
  byId("emptyCreateCollectionBtn").addEventListener("click", () =>
    openCollectionDialog(),
  );
  byId("newRequestBtn").addEventListener("click", newRequest);
  byId("saveRequestBtn").addEventListener("click", saveRequest);
  byId("saveRequestAsBtn").addEventListener("click", () => saveRequest(true));
  byId("sendBtn").addEventListener("click", sendRequest);
  byId("environmentSelect").addEventListener("change", async (event) => {
    state.config.activeEnvironmentId = event.target.value;
    await persistConfig();
    showToast(t("toast.environmentUpdated"), "success");
  });
  byId("copyResponseBtn").addEventListener("click", copyResponse);
  byId("clearResponseBtn").addEventListener("click", clearResponse);
  byId("formatJsonBtn").addEventListener("click", () => transformJson(true));
  byId("minifyJsonBtn").addEventListener("click", () => transformJson(false));
  byId("addParamBtn").addEventListener("click", () =>
    addKeyValueRow("paramsRows"),
  );
  byId("addHeaderBtn").addEventListener("click", () =>
    addKeyValueRow("headersRows"),
  );
  byId("addFormDataBtn").addEventListener("click", () =>
    addKeyValueRow("formDataRows"),
  );
  byId("cancelRequestBtn").addEventListener("click", cancelRequest);
  byId("collectionSearchInput").addEventListener("input", renderCollections);
  byId("compareResponseBtn").addEventListener("click", compareResponse);
  byId("exportHistoryBtn").addEventListener("click", exportHistory);
  byId("runLimitTestBtn").addEventListener("click", runLimitTest);
  byId("saveResponseVariableBtn").addEventListener(
    "click",
    saveResponseVariable,
  );
  document
    .querySelectorAll('[name="bodyType"]')
    .forEach((input) => input.addEventListener("change", toggleBodyEditor));
  document.querySelectorAll(".kv-rows").forEach((rows) =>
    rows.addEventListener("click", (event) => {
      if (event.target.classList.contains("btn-remove"))
        event.target.closest(".kv-row").remove();
    }),
  );
  document
    .querySelectorAll(".tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => switchTab(tab.dataset.tab)),
    );
  document
    .querySelectorAll(".response-tab")
    .forEach((tab) =>
      tab.addEventListener("click", () =>
        switchResponseTab(tab.dataset.responseTab),
      ),
    );
  byId("authTypeSelect").addEventListener("change", renderAuthFields);
  byId("modalCancelBtn").addEventListener("click", closeModal);
  byId("modalBackdrop").addEventListener("click", (event) => {
    if (event.target === byId("modalBackdrop")) closeModal();
  });
  byId("modalForm").addEventListener("submit", submitModal);
  byId("userModalCancelBtn").addEventListener("click", closeUserWindow);
  byId("userModalBackdrop").addEventListener("click", (event) => {
    if (event.target === byId("userModalBackdrop")) closeUserWindow();
  });
  byId("userModalForm").addEventListener("submit", saveUserSettings);
  document
    .querySelectorAll(".settings-tab")
    .forEach((tab) =>
      tab.addEventListener("click", () =>
        switchSettingsTab(tab.dataset.settingsTab),
      ),
    );
  byId("fullscreenResponseBtn").addEventListener("click", () =>
    document
      .querySelector(".response-section")
      .classList.toggle("response-fullscreen"),
  );
  byId("accountEnvironmentSelect").addEventListener(
    "change",
    renderEnvironmentSettings,
  );
  byId("addEnvironmentBtn").addEventListener("click", addEnvironment);
  byId("deleteEnvironmentBtn").addEventListener("click", deleteEnvironment);
  document.addEventListener("keydown", handleKeyboardShortcuts);
  document
    .querySelector(".request-content")
    .addEventListener("input", markDirty);
  initDragAndDrop(document.querySelector(".sidebar"));
}

function byId(id) {
  return document.getElementById(id);
}
function updateWelcomeMessage(config) {
  byId("userName").textContent = config.user?.name || "Usuario";
}
async function persistConfig() {
  const result = await window.electronAPI.saveConfig(state.config);
  if (!result.success)
    showToast("No se pudo guardar la configuración", "error");
  return result;
}
function activeEnvironment() {
  return (
    state.config.environments.find(
      (item) => item.id === state.config.activeEnvironmentId,
    ) || state.config.environments[0]
  );
}
function renderEnvironmentOptions() {
  byId("environmentSelect").innerHTML = state.config.environments
    .map(
      (env) =>
        `<option value="${escapeHtml(env.id)}">${escapeHtml(env.name)}</option>`,
    )
    .join("");
  byId("environmentSelect").value = state.config.activeEnvironmentId;
  byId("environmentSelect").title =
    `Active environment: ${activeEnvironment().name}`;
}
function markDirty() {
  state.isDirty = true;
  byId("dirtyIndicator").hidden = false;
}
function clearDirty() {
  state.isDirty = false;
  byId("dirtyIndicator").hidden = true;
}

// ── Colecciones y editor de requests ──────────────────────────────────────
async function loadSavedCollections() {
  const result = await window.electronAPI.loadAllCollections();
  state.collections = result.success ? result.collections : [];
  renderCollections();
}
function renderCollections() {
  const list = byId("collectionsList"),
    empty = byId("emptyCollections");
  list
    .querySelectorAll(".collection-container")
    .forEach((item) => item.remove());
  const term = byId("collectionSearchInput")?.value.trim().toLowerCase() || "";
  state.collections.forEach((collection) => {
    if (
      term &&
      !`${collection.info?.name || collection.name} ${(collection.requests || []).map((request) => `${request.name} ${request.url}`).join(" ")}`
        .toLowerCase()
        .includes(term)
    )
      return;
    const container = document.createElement("div");
    container.className = "collection-container";
    const header = document.createElement("div");
    header.className = "collection-item";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");
    const requestCount = (collection.requests || []).filter(
      (request) =>
        !term || `${request.name} ${request.url}`.toLowerCase().includes(term),
    ).length;
    header.innerHTML = `<span class="collection-chevron" aria-hidden="true">›</span><span class="collection-name">${escapeHtml(collection.info?.name || collection.name || "Colección sin nombre")}</span><span class="collection-count">${requestCount}</span><span class="collection-actions"><button type="button" data-collection-action="rename" title="Renombrar">✎</button><button type="button" data-collection-action="export" title="Exportar">⇧</button><button type="button" data-collection-action="remove" title="Quitar de la app">×</button></span>`;
    const requests = document.createElement("div");
    requests.className = "collection-requests is-collapsed";
    (collection.requests || [])
      .filter(
        (request) =>
          !term ||
          `${request.name} ${request.url}`.toLowerCase().includes(term),
      )
      .forEach((request, index) => {
        const item = document.createElement("div");
        item.className = "request-item";
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.dataset.requestId = request.id || "";
        item.dataset.collectionPath = collection.path;
        const method = (request.method || "GET").toUpperCase();
        item.innerHTML = `<span class="request-method method-${method.toLowerCase()}">${escapeHtml(method)}</span><span class="request-name">${escapeHtml(request.name || `Request ${index + 1}`)}</span><span class="request-actions"><button type="button" data-request-action="edit" title="Renombrar">✎</button><button type="button" data-request-action="duplicate" title="Duplicar">⧉</button><button type="button" data-request-action="move" title="Mover">⇄</button><button type="button" data-request-action="delete" title="Eliminar">×</button></span>`;
        item.addEventListener("click", () =>
          loadRequest(request, collection.path),
        );
        item.querySelectorAll("[data-request-action]").forEach((button) =>
          button.addEventListener("click", async (event) => {
            event.stopPropagation();
            await handleRequestAction(
              button.dataset.requestAction,
              request,
              collection,
            );
          }),
        );
        requests.appendChild(item);
      });
    const toggleRequests = () => {
      const expanded = requests.classList.toggle("is-collapsed");
      container.classList.toggle("expanded", !expanded);
      header.setAttribute("aria-expanded", String(!expanded));
    };
    header.addEventListener("click", toggleRequests);
    header.querySelectorAll("[data-collection-action]").forEach((button) =>
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        await handleCollectionAction(
          button.dataset.collectionAction,
          collection,
        );
      }),
    );
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleRequests();
      }
    });
    container.append(header, requests);
    list.insertBefore(container, empty);
  });
  empty.classList.toggle("hidden", state.collections.length > 0);
}

async function handleCollectionAction(action, collection) {
  if (action === "rename") {
    const name = window.prompt(
      "Nuevo nombre",
      collection.info?.name || collection.name,
    );
    if (!name?.trim()) return;
    await window.electronAPI.renameCollection(collection.path, name.trim());
  }
  if (action === "export")
    await window.electronAPI.exportCollection(collection);
  if (action === "remove") {
    if (
      !window.confirm(
        "¿Quitar esta colección de la app? El archivo JSON no se eliminará.",
      )
    )
      return;
    await window.electronAPI.removeCollection(collection.path);
  }
  await loadSavedCollections();
}
async function handleRequestAction(action, request, collection) {
  try {
    if (action === "edit") {
      const name = window.prompt("Nombre de la request", request.name);
      if (!name?.trim()) return;
      request.name = name.trim();
    } else if (action === "duplicate") {
      collection.requests.push({
        ...request,
        id: crypto.randomUUID(),
        name: `${request.name || "Request"} (copia)`,
      });
    } else if (action === "delete") {
      if (!window.confirm(`¿Eliminar “${request.name || "Request"}”?`)) return;
      collection.requests = collection.requests.filter(
        (item) => item.id !== request.id,
      );
      if (state.activeRequest?.id === request.id) newRequest();
    } else if (action === "move") {
      const choices = state.collections.filter(
        (item) => item.path !== collection.path,
      );
      if (!choices.length)
        return showToast(
          "Crea otra colección para mover esta request",
          "error",
        );
      const target =
        choices[
          Number(
            window.prompt(
              `Mover a: ${choices.map((item, index) => `${index + 1}. ${item.info?.name || item.name}`).join(" · ")}`,
            ),
          ) - 1
        ];
      if (!target) return;
      collection.requests = collection.requests.filter(
        (item) => item.id !== request.id,
      );
      (target.requests ||= []).push(request);
      const targetResult = await window.electronAPI.updateCollection(
        target.path,
        target,
      );
      if (!targetResult.success)
        throw new Error(targetResult.error || "No se pudo mover la request");
      if (state.activeRequest?.id === request.id)
        state.activeCollectionPath = target.path;
    } else return;
    const result = await window.electronAPI.updateCollection(
      collection.path,
      collection,
    );
    if (!result.success)
      throw new Error(result.error || "No se pudo guardar la request");
    await loadSavedCollections();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function newRequest() {
  state.activeCollectionPath = null;
  state.activeRequest = null;
  clearRequestEditor();
  clearDirty();
  showRequestContent();
  showToast(t("toast.newRequest"), "success");
}
function loadRequest(request, collectionPath) {
  state.activeCollectionPath = collectionPath;
  state.activeRequest = request;
  showRequestContent();
  hydrateRequest(request);
  clearDirty();
  document.querySelectorAll(".request-item").forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.requestId === request.id &&
        item.dataset.collectionPath === collectionPath,
    );
  });
  showToast(`Request cargada: ${request.name || "sin nombre"}`, "success");
}
function showRequestContent() {
  byId("emptyRequestState").classList.add("hidden");
  byId("requestContent").style.display = "flex";
}
function clearRequestEditor() {
  byId("methodSelect").value = "GET";
  byId("urlInput").value = "";
  fillKeyValues("paramsRows", []);
  fillKeyValues("headersRows", []);
  fillKeyValues("formDataRows", []);
  byId("bodyEditor").value = "";
  document.querySelector('[name="bodyType"][value="none"]').checked = true;
  byId("authTypeSelect").value = "none";
  renderAuthFields();
  toggleBodyEditor();
  clearResponse();
}
function hydrateRequest(request) {
  byId("methodSelect").value = request.method || "GET";
  byId("urlInput").value = request.url || "";
  fillKeyValues("paramsRows", request.params || []);
  fillKeyValues("headersRows", request.headers || []);
  byId("bodyEditor").value = request.body?.content || "";
  fillKeyValues("formDataRows", request.body?.formData || []);
  byId("bodyFormatSelect").value = request.body?.format || "json";
  const bodyType = request.body?.type || "none";
  const radio = document.querySelector(
    `[name="bodyType"][value="${bodyType}"]`,
  );
  if (radio) radio.checked = true;
  byId("authTypeSelect").value = request.auth?.type || "none";
  renderAuthFields(request.auth || {});
  toggleBodyEditor();
  clearResponse();
}
function fillKeyValues(containerId, values) {
  const container = byId(containerId);
  container.innerHTML = "";
  (values.length ? values : [{ key: "", value: "" }]).forEach((pair) =>
    addKeyValueRow(containerId, pair),
  );
}
function addKeyValueRow(containerId, pair = { key: "", value: "" }) {
  const row = document.createElement("div");
  row.className = "kv-row";
  const canAttachFile = containerId === "formDataRows";
  row.classList.toggle("form-data-row", canAttachFile);
  row.innerHTML = `<input class="kv-key" placeholder="nombre" value="${escapeHtml(pair.key || "")}"><input class="kv-value" placeholder="valor" value="${escapeHtml(pair.value || pair.filePath || "")}">${canAttachFile ? '<button class="btn-file" type="button" title="Attach file">⌁</button>' : ""}<button class="btn-remove" type="button" aria-label="Eliminar">×</button>`;
  row.querySelector(".btn-file")?.addEventListener("click", async () => {
    const filePath = await window.electronAPI.selectUploadFile();
    if (filePath) {
      row.dataset.filePath = filePath;
      row.querySelector(".kv-value").value = filePath.split("/").pop();
    }
  });
  byId(containerId).appendChild(row);
}
function getKeyValues(containerId) {
  return [...byId(containerId).querySelectorAll(".kv-row")]
    .map((row) => ({
      key: row.querySelector(".kv-key").value.trim(),
      value: row.querySelector(".kv-value").value.trim(),
      filePath: row.dataset.filePath || "",
    }))
    .filter((item) => item.key);
}

function renderAuthFields(auth = {}) {
  const type = byId("authTypeSelect").value,
    fields = byId("authFields");
  const templates = {
    none: '<p class="auth-hint">Esta petición no enviará credenciales.</p>',
    bearer:
      '<label>Token<input class="auth-input" id="authToken" placeholder="{{token}}" value=""></label>',
    basic:
      '<label>Usuario<input class="auth-input" id="authUsername" value=""></label><label>Contraseña<input class="auth-input" id="authPassword" type="password" value=""></label>',
    apikey:
      '<label>Nombre del header<input class="auth-input" id="authKeyName" placeholder="X-API-Key" value=""></label><label>Valor<input class="auth-input" id="authToken" placeholder="{{token}}" value=""></label>',
  };
  fields.innerHTML = templates[type];
  if (byId("authToken")) byId("authToken").value = auth.token || "";
  if (byId("authUsername")) byId("authUsername").value = auth.username || "";
  if (byId("authPassword")) byId("authPassword").value = auth.password || "";
  if (byId("authKeyName"))
    byId("authKeyName").value = auth.keyName || "X-API-Key";
}
function getAuth() {
  const type = byId("authTypeSelect").value;
  return {
    type,
    token: byId("authToken")?.value.trim() || "",
    username: byId("authUsername")?.value.trim() || "",
    password: byId("authPassword")?.value || "",
    keyName: byId("authKeyName")?.value.trim() || "X-API-Key",
  };
}
function collectRequest(name = state.activeRequest?.name || "") {
  return {
    id: state.activeRequest?.id || crypto.randomUUID(),
    name,
    method: byId("methodSelect").value,
    url: byId("urlInput").value.trim(),
    params: getKeyValues("paramsRows"),
    headers: getKeyValues("headersRows"),
    body: {
      type: document.querySelector('[name="bodyType"]:checked').value,
      format: byId("bodyFormatSelect").value,
      content: byId("bodyEditor").value,
      formData: getKeyValues("formDataRows"),
    },
    auth: getAuth(),
  };
}
function toggleBodyEditor() {
  const isFormData =
    document.querySelector('[name="bodyType"]:checked').value === "form-data";
  byId("formDataEditor").hidden = !isFormData;
  byId("bodyEditor")
    .closest(".body-editor-container")
    .classList.toggle("form-data-active", isFormData);
}
function replaceVariables(value) {
  return String(value || "").replace(
    /{{\s*([\w.-]+)\s*}}/g,
    (_, name) => activeEnvironment().variables?.[name] ?? `{{${name}}}`,
  );
}

// ── Validación y ejecución de peticiones ──────────────────────────────────
function validateRequest(request) {
  const url = replaceVariables(request.url);
  try {
    new URL(url);
  } catch {
    return t("validation.url");
  }
  if (url.includes("{{")) return t("validation.variable");
  if (
    request.body.type === "raw" &&
    request.body.format === "json" &&
    request.body.content.trim()
  ) {
    try {
      JSON.parse(request.body.content);
    } catch {
      return t("validation.json");
    }
  }
  if (request.auth.type === "bearer" && !replaceVariables(request.auth.token))
    return "Falta el token Bearer.";
  if (
    request.auth.type === "basic" &&
    (!request.auth.username || !request.auth.password)
  )
    return "Completa el usuario y la contraseña.";
  if (
    request.auth.type === "apikey" &&
    (!request.auth.keyName || !replaceVariables(request.auth.token))
  )
    return "Completa el nombre y valor de la API Key.";
  return null;
}
async function sendRequest() {
  const request = collectRequest();
  const validation = validateRequest(request);
  if (validation) return showToast(validation, "error");
  const url = new URL(replaceVariables(request.url));
  request.params.forEach(({ key, value }) =>
    url.searchParams.set(key, replaceVariables(value)),
  );
  const headers = Object.fromEntries(
    request.headers.map(({ key, value }) => [key, replaceVariables(value)]),
  );
  if (request.auth.type === "bearer")
    headers.Authorization = `Bearer ${replaceVariables(request.auth.token)}`;
  if (request.auth.type === "basic")
    headers.Authorization = `Basic ${btoa(`${request.auth.username}:${request.auth.password}`)}`;
  if (request.auth.type === "apikey")
    headers[request.auth.keyName] = replaceVariables(request.auth.token);
  const options = { method: request.method, headers };
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.body.type !== "none"
  ) {
    options.body =
      request.body.type === "x-www-form-urlencoded"
        ? new URLSearchParams(getKeyValues("paramsRows"))
        : request.body.content;
  }
  const formData =
    request.body.type === "form-data"
      ? request.body.formData.map((entry) => ({
          ...entry,
          value: replaceVariables(entry.value),
        }))
      : null;
  if (formData) delete headers["Content-Type"];
  setConnectionStatus("Conectando…", "loading", "Conexión en curso");
  byId("sendBtn").disabled = true;
  byId("cancelRequestBtn").disabled = false;
  state.activeExecutionId = crypto.randomUUID();
  const started = performance.now();
  try {
    const result = await window.electronAPI.executeRequest({
      id: state.activeExecutionId,
      url: url.toString(),
      method: options.method,
      headers: options.headers,
      body: options.body,
      formData,
      timeout: Number(state.config.requestTimeout) || 30000,
    });
    if (!result.success) throw new Error(result.error);
    let body = result.body;
    try {
      body = JSON.stringify(JSON.parse(result.body), null, 2);
    } catch {
      /* texto no JSON */
    }
    renderResponseBody(body || "(sin contenido)");
    runAssertions(result, body);
    byId("responseHeaders").textContent = Object.entries(result.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    const ok = result.status >= 200 && result.status < 300;
    setConnectionStatus(
      `${result.status} ${result.statusText}`,
      ok ? "success" : "error",
      `${result.duration} ms · ${formatBytes(result.size)} · ${ok ? "Conectado" : "Error HTTP"}`,
    );
    addHistory({
      ...request,
      url: request.url,
      status: result.status,
      duration: result.duration,
      createdAt: new Date().toISOString(),
    });
    showToast(
      ok ? "Respuesta recibida" : `Respuesta HTTP ${result.status}`,
      ok ? "success" : "error",
    );
  } catch (error) {
    setConnectionStatus("Sin conexión", "error", error.message);
    showToast(`Error de red: ${error.message}`, "error");
  } finally {
    byId("sendBtn").disabled = false;
    byId("cancelRequestBtn").disabled = true;
    state.activeExecutionId = null;
  }
}
async function cancelRequest() {
  if (state.activeExecutionId)
    await window.electronAPI.cancelRequest(state.activeExecutionId);
}
function formatBytes(bytes = 0) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
function renderResponseBody(body) {
  state.previousResponse = state.currentResponse;
  state.currentResponse = body;
  const target = byId("responseBody");
  try {
    JSON.parse(body);
    target.innerHTML = escapeHtml(body)
      .replace(
        /("(?:\\.|[^"\\])*")(?=\s*:)/g,
        '<span class="json-key">$1</span>',
      )
      .replace(/\b(true|false|null)\b/g, '<span class="json-literal">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="json-number">$1</span>');
  } catch {
    target.textContent = body;
  }
}
function setConnectionStatus(status, type, meta) {
  const el = byId("responseStatus");
  el.textContent = status;
  el.className = `response-status ${type}`;
  byId("responseMeta").textContent = meta;
}
function clearResponse() {
  byId("responseBody").textContent = "…";
  byId("responseHeaders").textContent = "…";
  setConnectionStatus(t("response.waiting"), "", t("response.offline"));
}
function compareResponse() {
  if (state.previousResponse == null)
    return showToast("Run another request to compare", "error");
  showToast(
    state.previousResponse === state.currentResponse
      ? "Responses match"
      : "Responses differ",
    "success",
  );
}
function runAssertions(result, body) {
  const expectedStatus = byId("assertStatus")?.value;
  const header = byId("assertHeader")?.value.trim().toLowerCase();
  const jsonPath = byId("assertJsonPath")?.value.trim();
  const failures = [];
  if (expectedStatus && Number(expectedStatus) !== result.status)
    failures.push(`status expected ${expectedStatus}, got ${result.status}`);
  if (
    header &&
    !Object.keys(result.headers || {}).some(
      (key) => key.toLowerCase() === header,
    )
  )
    failures.push(`missing header: ${header}`);
  if (jsonPath) {
    try {
      const value = jsonPath
        .split(".")
        .reduce((current, key) => current?.[key], JSON.parse(body));
      if (value === undefined) failures.push(`missing JSON path: ${jsonPath}`);
    } catch {
      failures.push("response is not valid JSON");
    }
  }
  if (failures.length)
    showToast(`Assertions failed: ${failures.join("; ")}`, "error");
}
function saveResponseVariable() {
  if (!state.currentResponse) return showToast("Run a request first", "error");
  const name = window.prompt("Variable name");
  const jsonPath = window.prompt("JSON path", "");
  if (!name) return;
  try {
    const value = jsonPath
      ? jsonPath
          .split(".")
          .reduce(
            (current, key) => current?.[key],
            JSON.parse(state.currentResponse),
          )
      : state.currentResponse;
    activeEnvironment().variables[name] = String(value ?? "");
    persistConfig();
    showToast(`Saved {{${name}}}`, "success");
  } catch {
    showToast("Could not read response JSON", "error");
  }
}
function exportHistory() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(state.config.history, null, 2)], {
      type: "application/json",
    }),
  );
  link.download = "openapi-client-history.json";
  link.click();
  URL.revokeObjectURL(link.href);
}
// Developer-only burst test; keep limits low to avoid accidental load testing.
async function runLimitTest() {
  const request = collectRequest(),
    validation = validateRequest(request);
  if (validation) return showToast(validation, "error");
  const count = Math.min(
    50,
    Math.max(1, Number(byId("testRequestCount").value) || 1),
  );
  const concurrency = Math.min(
    10,
    Math.max(1, Number(byId("testConcurrency").value) || 1),
  );
  const url = new URL(replaceVariables(request.url));
  const headers = Object.fromEntries(
    request.headers.map(({ key, value }) => [key, replaceVariables(value)]),
  );
  const results = [];
  let cursor = 0;
  byId("limitTestResults").textContent = `Running ${count} requests…`;
  const worker = async () => {
    while (cursor < count) {
      const number = ++cursor;
      results.push(
        await window.electronAPI.executeRequest({
          id: crypto.randomUUID(),
          url: url.toString(),
          method: request.method,
          headers,
          timeout: Number(state.config.requestTimeout) || 30000,
          number,
        }),
      );
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  const statuses = results.reduce((summary, result) => {
    const key = result.success ? result.status : "network error";
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
  const average = Math.round(
    results.reduce((total, result) => total + (result.duration || 0), 0) /
      results.length,
  );
  byId("limitTestResults").textContent =
    `Completed: ${results.length}/${count}\nAverage: ${average} ms\nRate limited (429): ${statuses[429] || 0}\n${JSON.stringify(statuses, null, 2)}`;
}
async function copyResponse() {
  try {
    await navigator.clipboard.writeText(byId("responseBody").textContent);
    showToast(t("toast.responseCopied"), "success");
  } catch {
    showToast("No se pudo copiar la respuesta", "error");
  }
}
function switchTab(name) {
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document
    .querySelectorAll(".tab-panel")
    .forEach((panel) =>
      panel.classList.toggle("active", panel.id === `${name}Panel`),
    );
}
function switchResponseTab(name) {
  document
    .querySelectorAll(".response-tab")
    .forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.responseTab === name),
    );
  byId("responseBodyPanel").classList.toggle("active", name === "body");
  byId("responseHeadersPanel").classList.toggle("active", name === "headers");
  byId("responseDiffPanel").classList.toggle("active", name === "diff");
  if (name === "diff") renderDiff();
}
function renderDiff() {
  const previous = state.previousResponse || "";
  const current = state.currentResponse || "";
  const previousLines = previous.split("\n"),
    currentLines = current.split("\n");
  byId("responseDiff").textContent = currentLines
    .map((line, index) =>
      line === previousLines[index]
        ? `  ${line}`
        : `+ ${line}\n- ${previousLines[index] || ""}`,
    )
    .join("\n");
}
function transformJson(pretty) {
  const editor = byId("bodyEditor");
  try {
    editor.value = pretty
      ? JSON.stringify(JSON.parse(editor.value), null, 2)
      : JSON.stringify(JSON.parse(editor.value));
    showToast(
      t(pretty ? "toast.jsonFormatted" : "toast.jsonMinified"),
      "success",
    );
  } catch {
    showToast("El body no contiene JSON válido", "error");
  }
}

// ── Historial ─────────────────────────────────────────────────────────────
function addHistory(request) {
  state.config.history.unshift(request);
  state.config.history = state.config.history.slice(0, 20);
  persistConfig();
  renderHistory();
}
function renderHistory() {
  const list = byId("historyList");
  if (!list) return;
  if (!state.config.history.length) {
    list.innerHTML = `<p class="history-empty">${escapeHtml(t("history.empty"))}</p>`;
    return;
  }
  list.innerHTML = "";
  state.config.history.forEach((entry) => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(entry.method)}</span><strong>${escapeHtml(entry.name || entry.url)}</strong><small>${entry.status || "—"} · ${entry.duration || 0} ms</small>`;
    button.addEventListener("click", () => {
      showRequestContent();
      hydrateRequest(entry);
      showToast("Petición restaurada desde el historial", "success");
    });
    list.appendChild(button);
  });
}

// ── Modales, notificaciones e interacción ─────────────────────────────────
function openCollectionDialog() {
  openModal({
    title: "Nueva colección",
    description: "Crea un archivo JSON para guardar tus peticiones.",
    label: "Nombre de la colección",
    confirm: "Crear",
    action: async (name) => {
      const result = await window.electronAPI.createCollection({
        name,
        requests: [],
      });
      if (!result.success)
        return showToast(
          result.message || "No se pudo crear la colección",
          "error",
        );
      await window.electronAPI.importCollection(result.path);
      await loadSavedCollections();
      clearDirty();
      showToast(t("toast.collectionCreated"), "success");
    },
  });
}

function saveRequest(saveAsNew = false) {
  if (!byId("urlInput").value.trim())
    return showToast(t("validation.saveUrl"), "error");
  if (!state.collections.length) return openCollectionDialog();
  openModal({
    title: "Guardar request",
    description: "Asigna un nombre y una colección de destino.",
    label: "Nombre de la request",
    confirm: "Guardar",
    collections: true,
    action: async (name, collectionPath) => {
      const collection = state.collections.find(
        (item) => item.path === collectionPath,
      );
      if (!collection)
        return showToast("Selecciona una colección válida", "error");
      const request = collectRequest(name);
      if (saveAsNew) request.id = crypto.randomUUID();
      const currentIndex =
        !saveAsNew && state.activeRequest?.id
          ? collection.requests.findIndex(
              (item) => item.id === state.activeRequest.id,
            )
          : -1;
      if (currentIndex >= 0 && state.activeCollectionPath === collectionPath)
        collection.requests[currentIndex] = request;
      else (collection.requests ||= []), collection.requests.push(request);
      const result = await window.electronAPI.updateCollection(
        collectionPath,
        collection,
      );
      if (!result.success)
        return showToast("No se pudo guardar la request", "error");
      state.activeRequest = request;
      state.activeCollectionPath = collectionPath;
      await loadSavedCollections();
      showToast(t("toast.requestSaved"), "success");
    },
  });
}

function openModal(options) {
  state.modalAction = options.action;
  byId("modalTitle").textContent = options.title;
  byId("modalDescription").textContent = options.description;
  byId("modalNameLabel").childNodes[0].textContent = options.label;
  byId("modalConfirmBtn").textContent = options.confirm;
  const select = byId("modalCollectionSelect"),
    label = byId("modalCollectionLabel");
  label.hidden = !options.collections;
  select.required = !!options.collections;
  select.innerHTML = state.collections
    .map(
      (item) =>
        `<option value="${escapeHtml(item.path)}">${escapeHtml(item.info?.name || item.name)}</option>`,
    )
    .join("");
  if (state.activeCollectionPath) select.value = state.activeCollectionPath;
  byId("modalNameInput").value = state.activeRequest?.name || "";
  byId("modalBackdrop").hidden = false;
  byId("modalNameInput").focus();
}
async function submitModal(event) {
  event.preventDefault();
  const name = byId("modalNameInput").value.trim();
  if (!name) return;
  const action = state.modalAction;
  closeModal();
  await action(name, byId("modalCollectionSelect").value);
}
function closeModal() {
  byId("modalBackdrop").hidden = true;
  state.modalAction = null;
}

function openUserWindow() {
  byId("accountNameInput").value = state.config.user?.name || "";
  byId("languageSelect").value = state.config.language;
  renderAccountEnvironments();
  byId("userModalBackdrop").hidden = false;
  switchSettingsTab("profile");
  byId("accountNameInput").focus();
}
function switchSettingsTab(name) {
  document
    .querySelectorAll(".settings-tab")
    .forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.settingsTab === name),
    );
  document
    .querySelectorAll(".settings-panel")
    .forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.settingsPanel === name),
    );
}
function renderAccountEnvironments() {
  const select = byId("accountEnvironmentSelect");
  select.innerHTML = state.config.environments
    .map(
      (env) =>
        `<option value="${escapeHtml(env.id)}">${escapeHtml(env.name)}</option>`,
    )
    .join("");
  select.value = state.config.activeEnvironmentId;
  renderEnvironmentSettings();
}
function renderEnvironmentSettings() {
  const environment =
    state.config.environments.find(
      (env) => env.id === byId("accountEnvironmentSelect").value,
    ) || activeEnvironment();
  byId("environmentBaseUrlInput").value = environment.variables?.baseUrl || "";
  byId("environmentTokenInput").value = environment.variables?.token || "";
  byId("requestTimeoutInput").value = state.config.requestTimeout || 30000;
  byId("deleteEnvironmentBtn").disabled = state.config.environments.length <= 1;
}
function addEnvironment() {
  const name = window.prompt("Nombre del entorno");
  if (!name?.trim()) return;
  const environment = {
    id: crypto.randomUUID(),
    name: name.trim(),
    variables: { baseUrl: "", token: "" },
  };
  state.config.environments.push(environment);
  state.config.activeEnvironmentId = environment.id;
  renderAccountEnvironments();
}
function deleteEnvironment() {
  const id = byId("accountEnvironmentSelect").value;
  state.config.environments = state.config.environments.filter(
    (env) => env.id !== id,
  );
  state.config.activeEnvironmentId = state.config.environments[0].id;
  renderAccountEnvironments();
}

function closeUserWindow() {
  byId("userModalBackdrop").hidden = true;
}

async function saveUserSettings(event) {
  event.preventDefault();
  state.config.user.name = byId("accountNameInput").value.trim() || "Usuario";
  state.config.language = byId("languageSelect").value;
  const environment = state.config.environments.find(
    (env) => env.id === byId("accountEnvironmentSelect").value,
  );
  environment.variables.baseUrl = byId("environmentBaseUrlInput").value.trim();
  environment.variables.token = byId("environmentTokenInput").value.trim();
  state.config.activeEnvironmentId = environment.id;
  state.config.requestTimeout = Math.max(
    1000,
    Number(byId("requestTimeoutInput").value) || 30000,
  );
  const result = await persistConfig();
  if (!result.success) return;
  updateWelcomeMessage(state.config);
  applyTranslations();
  renderEnvironmentOptions();
  closeUserWindow();
  showToast(t("account.save"), "success");
}
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  byId("toastContainer").appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
function handleKeyboardShortcuts(event) {
  const modal = !byId("userModalBackdrop").hidden
    ? byId("userModalForm")
    : !byId("modalBackdrop").hidden
      ? byId("modalForm")
      : null;
  if (modal && event.key === "Tab") {
    const focusable = [
      ...modal.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), select:not([disabled])",
      ),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === "Escape") {
    closeModal();
    closeUserWindow();
    return;
  }
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key === "Enter") {
    event.preventDefault();
    sendRequest();
  }
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveRequest();
  }
}
async function handleImportFile() {
  const path = await window.electronAPI.selectFile();
  if (path) await importCollection(path);
}
async function importCollection(path) {
  const result = await window.electronAPI.importCollection(path);
  if (result.success) {
    await loadSavedCollections();
    showToast(t("toast.collectionImported"), "success");
  } else showToast(result.error || "No se pudo importar", "error");
}
function initDragAndDrop(element) {
  ["dragenter", "dragover", "dragleave", "drop"].forEach((name) =>
    element.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
    }),
  );
  element.addEventListener("dragover", () =>
    element.classList.add("drag-over"),
  );
  element.addEventListener("dragleave", () =>
    element.classList.remove("drag-over"),
  );
  element.addEventListener("drop", async (event) => {
    element.classList.remove("drag-over");
    const file = event.dataTransfer.files[0];
    if (file?.name.endsWith(".json")) await importCollection(file.path);
    else showToast("Solo se pueden importar archivos JSON", "error");
  });
}
// ── Utilidades ────────────────────────────────────────────────────────────
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}
