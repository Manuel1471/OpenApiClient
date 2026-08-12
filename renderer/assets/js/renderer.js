/**
 * Punto de entrada del renderer.
 *
 * Organización: inicialización → configuración/estado → colecciones/editor →
 * ejecución HTTP → historial → modales/notificaciones → utilidades. Las
 * funciones se mantienen juntas temporalmente porque los componentes HTML se
 * cargan dinámicamente y comparten el mismo DOM.
 */
const DEFAULT_ENVIRONMENTS = Object.freeze([
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
]);

const EMPTY_REQUEST = Object.freeze({
  method: "GET",
  url: "",
  params: [],
  headers: [],
  body: { type: "none", format: "json", content: "", formData: [] },
  auth: { type: "none" },
});

const state = {
  config: null,
  collections: [],
  activeCollectionPath: null,
  activeRequest: null,
  modalAction: null,
  activeExecutionId: null,
  isDirty: false,
  currentResponse: null,
  previousResponse: null,
  collapsedFolders: new Set(),
  lastUndo: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  state.config = normalizeConfig(await window.electronAPI.getConfig());
  await loadComponents();
  applyTranslations();
  bindInterface();
  renderEnvironmentOptions();
  renderHistory();
  await loadSavedCollections();
  updateWelcomeMessage(state.config);
  window.setTimeout(() => byId("appSplash")?.classList.add("is-hidden"), 550);
});

// ── Configuración y estado ────────────────────────────────────────────────
function normalizeConfig(source) {
  const config = source && typeof source === "object" ? source : {};
  const environments = Array.isArray(config.environments)
    ? config.environments.map(normalizeEnvironment).filter(Boolean)
    : [];
  const normalizedEnvironments = environments.length
    ? environments
    : DEFAULT_ENVIRONMENTS.map(normalizeEnvironment);
  const activeEnvironmentId = normalizedEnvironments.some(
    (environment) => environment.id === config.activeEnvironmentId,
  )
    ? config.activeEnvironmentId
    : normalizedEnvironments[0].id;

  return {
    ...config,
    user: { name: "Usuario", ...(config.user || {}) },
    authentication: {
      enabled: false,
      provider: null,
      session: null,
      ...(config.authentication || {}),
    },
    collections: Array.isArray(config.collections) ? config.collections : [],
    globalVariables: normalizeVariables(config.globalVariables),
    folders: Array.isArray(config.folders) ? config.folders.filter((folder) => folder?.id && folder?.name) : [],
    collectionFolders: config.collectionFolders && typeof config.collectionFolders === "object" ? config.collectionFolders : {},
    history: Array.isArray(config.history)
      ? config.history.map(normalizeRequest)
      : [],
    environments: normalizedEnvironments,
    activeEnvironmentId,
    language: window.translations?.[config.language] ? config.language : "es",
  };
}

function normalizeEnvironment(environment) {
  if (!environment || typeof environment !== "object") return null;
  return {
    id: String(environment.id || crypto.randomUUID()),
    name: String(environment.name || "Entorno"),
    variables: {
      baseUrl: "",
      token: "",
      ...(environment.variables || {}),
    },
  };
}

function normalizeCollection(collection) {
  if (!collection || typeof collection !== "object") return null;
  return {
    ...collection,
    info: {
      ...(collection.info || {}),
      name: collection.info?.name || collection.name || "Colección sin nombre",
    },
    requests: Array.isArray(collection.requests)
      ? collection.requests.map(normalizeRequest)
      : [],
  };
}

function normalizeRequest(request = {}) {
  const body = request.body || {};
  return {
    ...EMPTY_REQUEST,
    ...request,
    id: request.id || crypto.randomUUID(),
    name: String(request.name || ""),
    method: String(request.method || EMPTY_REQUEST.method).toUpperCase(),
    url: String(request.url || ""),
    params: normalizeKeyValues(request.params),
    headers: normalizeKeyValues(request.headers),
    body: {
      ...EMPTY_REQUEST.body,
      ...body,
      content: String(body.content || ""),
      formData: normalizeKeyValues(body.formData),
    },
    auth: { ...EMPTY_REQUEST.auth, ...(request.auth || {}) },
  };
}

function normalizeKeyValues(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      key: String(entry.key || ""),
      value: String(entry.value || ""),
      filePath: String(entry.filePath || ""),
      mimeType: String(entry.mimeType || ""),
    }));
}

function t(key) {
  return window.translations?.[state.config?.language || "es"]?.[key] || key;
}

function tFormat(key, values = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function normalizeVariables(variables) {
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) return {};
  return Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, String(value ?? "")]));
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
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
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
  byId("newFolderBtn").addEventListener("click", openFolderDialog);
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
  byId("addEnvironmentVariableBtn").addEventListener("click", () => addVariableRow("environmentVariablesRows"));
  byId("addGlobalVariableBtn").addEventListener("click", () => addVariableRow("globalVariablesRows"));
  document.querySelectorAll(".response-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", startResponseResize);
    handle.addEventListener("keydown", handleResponseResizeKeyboard);
  });
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
    showToast(t("error.saveConfig"), "error");
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
  byId("environmentSelect").title = `${t("request.environment")}: ${activeEnvironment().name}`;
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
  state.collections = result.success
    ? result.collections.map(normalizeCollection).filter(Boolean)
    : [];
  renderCollections();
}
function renderCollections() {
  const list = byId("collectionsList"),
    empty = byId("emptyCollections");
  list
    .querySelectorAll(".collection-container, .folder-item")
    .forEach((item) => item.remove());
  const term = byId("collectionSearchInput")?.value.trim().toLowerCase() || "";
  let lastFolderId = null;
  state.collections
    .slice()
    .sort((a, b) => folderNameForCollection(a).localeCompare(folderNameForCollection(b)))
    .forEach((collection) => {
    if (
      term &&
      !`${collection.info?.name || collection.name} ${(collection.requests || []).map((request) => `${request.name} ${request.url}`).join(" ")}`
        .toLowerCase()
        .includes(term)
    )
      return;
    const folderId = folderIdForCollection(collection);
    if (folderId !== lastFolderId) {
      const folder = document.createElement("div");
      folder.className = "folder-item";
      const isCollapsed = state.collapsedFolders.has(folderId);
      folder.classList.toggle("is-collapsed", isCollapsed);
      folder.style.marginLeft = `${folderDepth(folderId) * 12 + 8}px`;
      folder.setAttribute("role", "button");
      folder.setAttribute("tabindex", "0");
      folder.setAttribute("aria-expanded", String(!isCollapsed));
      folder.innerHTML = `<span class="folder-chevron" aria-hidden="true">▾</span><span>${escapeHtml(folderNameForCollection(collection))}</span>${folderId === "root" ? "" : `<span class="folder-actions"><button type="button" data-folder-action="rename">✎</button><button type="button" data-folder-action="delete">×</button></span>`}`;
      folder.dataset.folderId = folderId;
      folder.addEventListener("dragover", (event) => event.preventDefault());
      folder.addEventListener("drop", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const path = event.dataTransfer.getData("application/x-openapi-collection");
        if (path) {
          state.config.collectionFolders[path] = folderId;
          await persistConfig();
          renderCollections();
        }
      });
      folder.querySelectorAll("[data-folder-action]").forEach((button) => button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleFolderAction(button.dataset.folderAction, folderId);
      }));
      const toggleFolder = () => {
        if (state.collapsedFolders.has(folderId)) state.collapsedFolders.delete(folderId);
        else state.collapsedFolders.add(folderId);
        renderCollections();
      };
      folder.addEventListener("click", toggleFolder);
      folder.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleFolder();
        }
      });
      list.insertBefore(folder, empty);
      lastFolderId = folderId;
    }
    if (state.collapsedFolders.has(folderId)) return;
    const container = document.createElement("div");
    container.className = "collection-container";
    container.draggable = true;
    container.addEventListener("dragstart", (event) => {
      if (event.target.closest(".request-item")) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-openapi-collection", collection.path);
    });
    const header = document.createElement("div");
    header.className = "collection-item";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");
    const requestCount = (collection.requests || []).filter(
      (request) =>
        !term || `${request.name} ${request.url}`.toLowerCase().includes(term),
    ).length;
    header.innerHTML = `<span class="collection-chevron" aria-hidden="true">›</span><span class="collection-name">${escapeHtml(collection.info?.name || collection.name || t("common.collection"))}</span><span class="collection-count">${requestCount}</span><span class="collection-actions"><button type="button" data-collection-action="rename" title="${escapeHtml(t("common.rename"))}">✎</button><button type="button" data-collection-action="export" title="${escapeHtml(t("common.export"))}">⇧</button><button type="button" data-collection-action="remove" title="${escapeHtml(t("common.remove"))}">×</button></span>`;
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
        item.draggable = true;
        const method = (request.method || "GET").toUpperCase();
        item.innerHTML = `<span class="request-method method-${method.toLowerCase()}">${escapeHtml(method)}</span><span class="request-name">${escapeHtml(request.name || `${t("common.request")} ${index + 1}`)}</span><span class="request-actions"><button type="button" data-request-action="edit" title="${escapeHtml(t("common.rename"))}">✎</button><button type="button" data-request-action="duplicate" title="${escapeHtml(t("common.duplicate"))}">⧉</button><button type="button" data-request-action="move" title="${escapeHtml(t("common.move"))}">⇄</button><button type="button" data-request-action="delete" title="${escapeHtml(t("common.delete"))}">×</button></span>`;
        item.addEventListener("click", () =>
          loadRequest(request, collection.path),
        );
        item.addEventListener("dragstart", (event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "application/x-openapi-request",
            JSON.stringify({ collectionPath: collection.path, requestId: request.id }),
          );
        });
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
    header.addEventListener("dragover", (event) => {
      if (Array.from(event.dataTransfer.types).includes("application/x-openapi-request")) {
        event.preventDefault();
        header.classList.add("drag-target");
      }
    });
    header.addEventListener("dragleave", () => header.classList.remove("drag-target"));
    header.addEventListener("drop", async (event) => {
      header.classList.remove("drag-target");
      const raw = event.dataTransfer.getData("application/x-openapi-request");
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      await moveRequestByDrag(JSON.parse(raw), collection.path);
    });
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
async function moveRequestByDrag(source, targetPath) {
  if (!source?.collectionPath || !source.requestId || source.collectionPath === targetPath) return;
  const origin = state.collections.find((collection) => collection.path === source.collectionPath);
  const target = state.collections.find((collection) => collection.path === targetPath);
  const request = origin?.requests?.find((item) => item.id === source.requestId);
  if (!origin || !target || !request) return;
  try {
    const originBefore = [...origin.requests];
    const targetBefore = origin === target ? originBefore : [...target.requests];
    origin.requests = origin.requests.filter((item) => item.id !== request.id);
    (target.requests ||= []).push(request);
    const [originResult, targetResult] = await Promise.all([
      window.electronAPI.updateCollection(origin.path, origin),
      window.electronAPI.updateCollection(target.path, target),
    ]);
    if (!originResult.success || !targetResult.success) throw new Error(t("error.saveRequest"));
    if (state.activeRequest?.id === request.id) state.activeCollectionPath = target.path;
    await loadSavedCollections();
    showToast(t("toast.requestMoved"), "success");
    offerUndo(async () => {
      origin.requests = originBefore;
      if (origin !== target) target.requests = targetBefore;
      await window.electronAPI.updateCollection(origin.path, origin);
      if (origin !== target) await window.electronAPI.updateCollection(target.path, target);
      await loadSavedCollections();
    });
  } catch (error) {
    showToast(error.message || t("error.saveRequest"), "error");
  }
}
function folderNameForCollection(collection) {
  const id = folderIdForCollection(collection);
  return id === "root" ? t("folder.root") : state.config.folders.find((folder) => folder.id === id)?.name || t("folder.root");
}
function folderIdForCollection(collection) {
  const id = state.config.collectionFolders?.[collection.path];
  return id && state.config.folders.some((folder) => folder.id === id) ? id : "root";
}
function folderDepth(id) {
  let depth = 0;
  let folder = state.config.folders.find((item) => item.id === id);
  while (folder?.parentId && depth < 6) {
    depth += 1;
    folder = state.config.folders.find((item) => item.id === folder.parentId);
  }
  return depth;
}
function openFolderDialog() {
  openModal({
    title: t("folder.new"),
    description: t("folder.description"),
    label: t("folder.name"),
    confirm: t("common.create"),
    choiceLabel: t("folder.parent"),
    choices: [{ value: "root", label: t("folder.root") }, ...state.config.folders.map((folder) => ({ value: folder.id, label: folder.name }))],
    action: async (name, parentId) => {
      state.config.folders.push({ id: crypto.randomUUID(), name, parentId: parentId === "root" ? null : parentId });
      await persistConfig();
      renderCollections();
    },
  });
}
function handleFolderAction(action, folderId) {
  const folder = state.config.folders.find((item) => item.id === folderId);
  if (!folder) return;
  if (action === "rename") return openModal({
    title: t("folder.rename"), description: t("folder.description"), label: t("folder.name"),
    confirm: t("common.rename"), value: folder.name,
    action: async (name) => { folder.name = name; await persistConfig(); renderCollections(); },
  });
  return openModal({
    title: t("folder.delete"), description: t("folder.deleteDescription"), confirm: t("common.delete"), noInput: true,
    action: async () => {
      state.config.folders = state.config.folders.filter((item) => item.id !== folderId);
      state.config.folders.forEach((item) => { if (item.parentId === folderId) item.parentId = null; });
      Object.keys(state.config.collectionFolders).forEach((path) => { if (state.config.collectionFolders[path] === folderId) delete state.config.collectionFolders[path]; });
      await persistConfig(); renderCollections();
    },
  });
}

async function handleCollectionAction(action, collection) {
  if (action === "rename") {
    return openModal({
      title: t("dialog.renameCollection.title"),
      description: t("dialog.rename.description"),
      label: t("dialog.newCollection.label"),
      confirm: t("common.rename"),
      value: collection.info?.name || collection.name,
      action: async (name) => {
        await window.electronAPI.renameCollection(collection.path, name);
        await loadSavedCollections();
        showToast(t("toast.collectionRenamed"), "success");
      },
    });
  }
  if (action === "export") {
    await window.electronAPI.exportCollection(collection);
    return;
  }
  if (action === "remove")
    return openModal({
      title: t("dialog.removeCollection.title"),
      description: t("dialog.removeCollection.description"),
      confirm: t("common.remove"),
      noInput: true,
      action: async () => {
        await window.electronAPI.removeCollection(collection.path);
        await loadSavedCollections();
        showToast(t("toast.collectionRemoved"), "success");
      },
    });
}
async function handleRequestAction(action, request, collection) {
  try {
    if (action === "edit") {
      return openModal({
        title: t("dialog.renameRequest.title"),
        description: t("dialog.rename.description"),
        label: t("dialog.saveRequest.label"),
        confirm: t("common.rename"),
        value: request.name,
        action: async (name) => {
          request.name = name;
          await persistRequestCollection(collection);
          showToast(t("toast.requestSaved"), "success");
        },
      });
    } else if (action === "duplicate") {
      collection.requests.push({
        ...request,
        id: crypto.randomUUID(),
        name: `${request.name || t("common.request")} (${t("common.duplicate").toLowerCase()})`,
      });
    } else if (action === "delete") {
      return openModal({
        title: t("dialog.deleteRequest.title"),
        description: t("dialog.deleteRequest.description"),
        confirm: t("common.delete"),
        noInput: true,
        action: async () => {
          collection.requests = collection.requests.filter((item) => item.id !== request.id);
          if (state.activeRequest?.id === request.id) newRequest();
          await persistRequestCollection(collection);
          showToast(t("toast.requestDeleted"), "success");
        },
      });
    } else if (action === "move") {
      const choices = state.collections.filter(
        (item) => item.path !== collection.path,
      );
      if (!choices.length)
        return showToast(t("dialog.noDestination"), "error");
      return openModal({
        title: t("dialog.moveRequest.title"),
        description: t("dialog.moveRequest.description"),
        confirm: t("common.move"),
        noInput: true,
        choiceLabel: t("dialog.moveRequest.destination"),
        choices: choices.map((item) => ({
          value: item.path,
          label: item.info?.name || item.name,
        })),
        action: async (_, targetPath) => {
          const target = choices.find((item) => item.path === targetPath);
          if (!target) return;
          collection.requests = collection.requests.filter((item) => item.id !== request.id);
          (target.requests ||= []).push(request);
          const targetResult = await window.electronAPI.updateCollection(target.path, target);
          if (!targetResult.success) throw new Error(targetResult.error || t("error.saveRequest"));
          if (state.activeRequest?.id === request.id) state.activeCollectionPath = target.path;
          await persistRequestCollection(collection);
          showToast(t("toast.requestMoved"), "success");
        },
      });
    } else return;
    await persistRequestCollection(collection);
    showToast(t("toast.requestDuplicated"), "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function persistRequestCollection(collection) {
  const result = await window.electronAPI.updateCollection(collection.path, collection);
  if (!result.success) throw new Error(result.error || t("error.saveRequest"));
  await loadSavedCollections();
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
  state.activeRequest = normalizeRequest(request);
  showRequestContent();
  hydrateRequest(state.activeRequest);
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
  byId("assertStatus").value = "";
  byId("assertHeader").value = "";
  byId("assertJsonPath").value = "";
  byId("assertOperator").value = "exists";
  byId("assertExpectedValue").value = "";
  byId("chainVariableName").value = "";
  byId("chainJsonPath").value = "";
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
  byId("assertStatus").value = request.tests?.expectedStatus || "";
  byId("assertHeader").value = request.tests?.header || "";
  byId("assertJsonPath").value = request.tests?.jsonPath || "";
  byId("assertOperator").value = request.tests?.operator || "exists";
  byId("assertExpectedValue").value = request.tests?.expectedValue || "";
  byId("chainVariableName").value = request.chaining?.variableName || "";
  byId("chainJsonPath").value = request.chaining?.jsonPath || "";
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
  row.innerHTML = `<input class="kv-key" aria-label="Key" placeholder="nombre" value="${escapeHtml(pair.key || "")}"><input class="kv-value" aria-label="Value" placeholder="valor" value="${escapeHtml(pair.value || pair.filePath || "")}">${canAttachFile ? `<input class="kv-mime" aria-label="MIME type" placeholder="MIME" value="${escapeHtml(pair.mimeType || "")}"><button class="btn-file" type="button" aria-label="Attach files" title="Attach files">⌁</button>` : ""}<button class="btn-remove" type="button" aria-label="Remove row">×</button>`;
  row.querySelector(".btn-file")?.addEventListener("click", async () => {
    const filePaths = await window.electronAPI.selectUploadFiles();
    if (!filePaths?.length) return;
    row.dataset.filePath = filePaths[0];
    row.querySelector(".kv-value").value = filePaths[0].split("/").pop();
    row.querySelector(".kv-value").title = filePaths[0];
    filePaths.slice(1).forEach((filePath) => addKeyValueRow(containerId, {
      key: row.querySelector(".kv-key").value,
      value: filePath.split("/").pop(), filePath,
    }));
  });
  byId(containerId).appendChild(row);
}
function getKeyValues(containerId) {
  return [...byId(containerId).querySelectorAll(".kv-row")]
    .map((row) => ({
      key: row.querySelector(".kv-key").value.trim(),
      value: row.querySelector(".kv-value").value.trim(),
      filePath: row.dataset.filePath || "",
      mimeType: row.querySelector(".kv-mime")?.value.trim() || "",
    }))
    .filter((item) => item.key);
}

function renderAuthFields(auth = {}) {
  const type = byId("authTypeSelect").value,
    fields = byId("authFields");
  const templates = {
    none: `<p class="auth-hint">${escapeHtml(t("auth.noCredentials"))}</p>`,
    bearer:
      `<label>${escapeHtml(t("auth.token"))}<input class="auth-input" id="authToken" placeholder="{{token}}" value=""></label>`,
    basic:
      `<label>${escapeHtml(t("auth.username"))}<input class="auth-input" id="authUsername" value=""></label><label>${escapeHtml(t("auth.password"))}<input class="auth-input" id="authPassword" type="password" value=""></label>`,
    apikey:
      `<label>${escapeHtml(t("auth.headerName"))}<input class="auth-input" id="authKeyName" placeholder="X-API-Key" value=""></label><label>${escapeHtml(t("auth.value"))}<input class="auth-input" id="authToken" placeholder="{{token}}" value=""></label>`,
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
  return normalizeRequest({
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
    tests: collectTests(),
    chaining: {
      variableName: byId("chainVariableName")?.value.trim() || "",
      jsonPath: byId("chainJsonPath")?.value.trim() || "",
    },
  });
}
function collectTests() {
  return {
    expectedStatus: byId("assertStatus")?.value || "",
    header: byId("assertHeader")?.value || "",
    jsonPath: byId("assertJsonPath")?.value || "",
    operator: byId("assertOperator")?.value || "exists",
    expectedValue: byId("assertExpectedValue")?.value || "",
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
    (_, name) => activeEnvironment().variables?.[name] ?? state.config.globalVariables?.[name] ?? `{{${name}}}`,
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
    return t("error.bearer");
  if (
    request.auth.type === "basic" &&
    (!request.auth.username || !request.auth.password)
  )
    return t("error.basic");
  if (
    request.auth.type === "apikey" &&
    (!request.auth.keyName || !replaceVariables(request.auth.token))
  )
    return t("error.apiKey");
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
  setConnectionStatus(t("request.connecting"), "loading", t("request.inProgress"));
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
    renderResponseBody(body || t("response.emptyContent"));
    runAssertions(result, body);
    applyResponseChain(request, body);
    byId("responseHeaders").textContent = Object.entries(result.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    const ok = result.status >= 200 && result.status < 300;
    setConnectionStatus(
      `${result.status} ${result.statusText}`,
      ok ? "success" : "error",
      `${result.duration} ms · ${formatBytes(result.size)} · ${ok ? t("request.connected") : t("request.httpError")}`,
    );
    addHistory({
      ...request,
      url: request.url,
      status: result.status,
      duration: result.duration,
      createdAt: new Date().toISOString(),
    });
    showToast(
      ok ? t("toast.responseReceived") : tFormat("toast.httpResponse", { status: result.status }),
      ok ? "success" : "error",
    );
  } catch (error) {
    const detail = error.errorType ? `${t(`network.${error.errorType}`)} · ${error.message}` : error.message;
    setConnectionStatus(t("response.offline"), "error", detail);
    showToast(tFormat("toast.networkError", { message: detail }), "error");
  } finally {
    byId("sendBtn").disabled = false;
    byId("cancelRequestBtn").disabled = true;
    state.activeExecutionId = null;
  }
}
async function applyResponseChain(request, body) {
  const name = request.chaining?.variableName;
  if (!name) return;
  try {
    const value = request.chaining.jsonPath
      ? request.chaining.jsonPath.split(".").reduce((current, key) => current?.[key], JSON.parse(body))
      : body;
    activeEnvironment().variables[name] = String(value ?? "");
    await persistConfig();
    showToast(tFormat("toast.variableSaved", { name: `{{${name}}}` }), "success");
  } catch {
    showToast(t("error.responseJson"), "error");
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
  const tests = collectTests();
  const expectedStatus = tests.expectedStatus;
  const header = tests.header.trim().toLowerCase();
  const jsonPath = tests.jsonPath.trim();
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
      else if (tests.operator === "equals" && String(value) !== tests.expectedValue)
        failures.push(`JSON path ${jsonPath} expected ${tests.expectedValue}, got ${value}`);
      else if (tests.operator === "contains" && !String(value).includes(tests.expectedValue))
        failures.push(`JSON path ${jsonPath} does not contain ${tests.expectedValue}`);
    } catch {
      failures.push("response is not valid JSON");
    }
  }
  const results = byId("assertionResults");
  if (failures.length) {
    results.textContent = `${t("assertion.fail")}:\n${failures.map((failure) => `× ${failure}`).join("\n")}`;
    results.className = "assertion-results error";
    showToast(`${t("assertion.fail")}: ${failures.join("; ")}`, "error");
  } else if (expectedStatus || header || jsonPath) {
    results.textContent = `✓ ${t("assertion.pass")}`;
    results.className = "assertion-results success";
  } else {
    results.textContent = "";
  }
}
function saveResponseVariable() {
  if (!state.currentResponse) return showToast("Run a request first", "error");
  openModal({
    title: t("dialog.saveVariable.title"),
    description: t("dialog.saveVariable.description"),
    label: t("dialog.saveVariable.label"),
    confirm: t("common.save"),
    action: (name) => openModal({
      title: t("dialog.saveVariablePath.title"),
      description: t("dialog.saveVariablePath.description"),
      label: t("dialog.saveVariablePath.label"),
      confirm: t("common.save"),
      optionalInput: true,
      value: "",
      action: async (jsonPath) => {
        try {
          const value = jsonPath
            ? jsonPath.split(".").reduce((current, key) => current?.[key], JSON.parse(state.currentResponse))
            : state.currentResponse;
          activeEnvironment().variables[name] = String(value ?? "");
          await persistConfig();
          showToast(tFormat("toast.variableSaved", { name: `{{${name}}}` }), "success");
        } catch {
          showToast(t("error.responseJson"), "error");
        }
      },
    }),
  });
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
    showToast(t("error.copy"), "error");
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
  try {
    const changes = diffJson(JSON.parse(previous), JSON.parse(current));
    byId("responseDiff").textContent = changes.length
      ? changes.map(({ path, before, after }) => `${path}\n- ${JSON.stringify(before)}\n+ ${JSON.stringify(after)}`).join("\n\n")
      : "JSON objects match.";
    return;
  } catch {
    // Non-JSON responses use the line diff below.
  }
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
function diffJson(before, after, path = "$") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object")
    return [{ path, before, after }];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) => diffJson(before[key], after[key], `${path}.${key}`));
}
function startResponseResize(event) {
  const section = event.currentTarget.closest(".response-section");
  const startY = event.clientY;
  const startHeight = section.getBoundingClientRect().height;
  event.currentTarget.setPointerCapture(event.pointerId);
  const resize = (moveEvent) => {
    setResponseHeight(section, startHeight + (moveEvent.clientY - startY));
  };
  const stop = () => {
    event.currentTarget.removeEventListener("pointermove", resize);
    event.currentTarget.removeEventListener("pointerup", stop);
  };
  event.currentTarget.addEventListener("pointermove", resize);
  event.currentTarget.addEventListener("pointerup", stop);
}
function handleResponseResizeKeyboard(event) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const section = event.currentTarget.closest('.response-section');
  const current = section.getBoundingClientRect().height;
  const height = event.key === 'Home' ? 230 : event.key === 'End' ? window.innerHeight - 120 : current + (event.key === 'ArrowDown' ? 24 : -24);
  setResponseHeight(section, height);
}
function setResponseHeight(section, height) {
  const next = Math.round(Math.max(230, Math.min(window.innerHeight - 120, height)));
  section.style.height = `${next}px`;
  section.querySelector('.response-resize-handle')?.setAttribute('aria-valuenow', String(next));
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
    showToast(t("error.jsonBody"), "error");
  }
}

// ── Historial ─────────────────────────────────────────────────────────────
function addHistory(request) {
  state.config.history.unshift(normalizeRequest(request));
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
      showToast(t("toast.historyRestored"), "success");
    });
    list.appendChild(button);
  });
}

// ── Modales, notificaciones e interacción ─────────────────────────────────
function openCollectionDialog() {
  openModal({
    title: t("dialog.newCollection.title"),
    description: t("dialog.newCollection.description"),
    label: t("dialog.newCollection.label"),
    confirm: t("common.create"),
    action: async (name) => {
      const result = await window.electronAPI.createCollection({
        name,
        requests: [],
      });
      if (!result.success)
        return showToast(
          result.message || t("error.saveRequest"),
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
    title: t("dialog.saveRequest.title"),
    description: t("dialog.saveRequest.description"),
    label: t("dialog.saveRequest.label"),
    confirm: t("common.save"),
    collections: true,
    action: async (name, collectionPath) => {
      const collection = state.collections.find(
        (item) => item.path === collectionPath,
      );
      if (!collection)
        return showToast(t("error.validCollection"), "error");
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
        return showToast(t("error.saveRequest"), "error");
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
  const input = byId("modalNameInput");
  const inputLabel = byId("modalNameLabel");
  inputLabel.hidden = Boolean(options.noInput);
  input.required = !options.noInput && !options.optionalInput;
  inputLabel.querySelector("span").textContent = options.label || t("form.name");
  byId("modalConfirmBtn").textContent = options.confirm;
  byId("modalCancelBtn").textContent = t("common.cancel");
  const select = byId("modalCollectionSelect");
  const selectLabel = byId("modalCollectionLabel");
  const choices = options.choices || (options.collections
    ? state.collections.map((item) => ({
        value: item.path,
        label: item.info?.name || item.name,
      }))
    : []);
  selectLabel.hidden = choices.length === 0;
  select.required = choices.length > 0;
  selectLabel.querySelector("span").textContent =
    options.choiceLabel || t("form.collection");
  select.innerHTML = choices
    .map(
      (choice) =>
        `<option value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</option>`,
    )
    .join("");
  if (options.collections && state.activeCollectionPath)
    select.value = state.activeCollectionPath;
  input.value = options.value ?? (state.activeRequest?.name || "");
  byId("modalBackdrop").style.zIndex = byId("userModalBackdrop").hidden
    ? ""
    : "26";
  byId("modalBackdrop").hidden = false;
  (options.noInput && choices.length ? select : input).focus();
}
async function submitModal(event) {
  event.preventDefault();
  const input = byId("modalNameInput");
  const name = input.value.trim();
  if (input.required && !name) return;
  const action = state.modalAction;
  const choice = byId("modalCollectionSelect").value;
  closeModal();
  await action?.(name, choice);
}
function closeModal() {
  byId("modalBackdrop").hidden = true;
  byId("modalBackdrop").style.zIndex = "";
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
  renderVariableRows("environmentVariablesRows", environment.variables || {});
  renderVariableRows("globalVariablesRows", state.config.globalVariables || {});
}
function renderVariableRows(containerId, variables) {
  const container = byId(containerId);
  container.innerHTML = "";
  Object.entries(variables).forEach(([name, value]) => addVariableRow(containerId, name, value));
}
function addVariableRow(containerId, name = "", value = "") {
  const row = document.createElement("div");
  row.className = "variable-row";
  row.innerHTML = `<input class="variable-name" placeholder="name" value="${escapeHtml(name)}"><input class="variable-value" type="password" placeholder="value" value="${escapeHtml(value)}"><button type="button" class="variable-visibility" title="Show value">◉</button><button type="button" class="btn-remove" aria-label="Remove variable">×</button>`;
  row.querySelector(".variable-visibility").addEventListener("click", () => {
    const input = row.querySelector(".variable-value");
    input.type = input.type === "password" ? "text" : "password";
  });
  row.querySelector(".btn-remove").addEventListener("click", () => row.remove());
  byId(containerId).appendChild(row);
}
function readVariableRows(containerId) {
  return Object.fromEntries([...byId(containerId).querySelectorAll(".variable-row")]
    .map((row) => [row.querySelector(".variable-name").value.trim(), row.querySelector(".variable-value").value])
    .filter(([name]) => name));
}
function addEnvironment() {
  openModal({
    title: t("dialog.newEnvironment.title"),
    description: t("dialog.newEnvironment.description"),
    label: t("dialog.newEnvironment.label"),
    confirm: t("common.create"),
    action: async (name) => {
      const environment = {
        id: crypto.randomUUID(),
        name,
        variables: { baseUrl: "", token: "" },
      };
      state.config.environments.push(environment);
      state.config.activeEnvironmentId = environment.id;
      renderAccountEnvironments();
    },
  });
}
function deleteEnvironment() {
  const id = byId("accountEnvironmentSelect").value;
  if (state.config.environments.length <= 1) return;
  openModal({
    title: t("dialog.deleteEnvironment.title"),
    description: t("dialog.deleteEnvironment.description"),
    confirm: t("common.delete"),
    noInput: true,
    action: async () => {
      state.config.environments = state.config.environments.filter(
        (env) => env.id !== id,
      );
      state.config.activeEnvironmentId = state.config.environments[0].id;
      renderAccountEnvironments();
    },
  });
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
  environment.variables = { ...environment.variables, ...readVariableRows("environmentVariablesRows") };
  state.config.globalVariables = readVariableRows("globalVariablesRows");
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
function showToast(message, type = "success", action = null) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = t("common.undo");
    button.addEventListener("click", async () => {
      await action();
      toast.remove();
    });
    toast.appendChild(button);
  }
  byId("toastContainer").appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
function offerUndo(action) {
  state.lastUndo = action;
  showToast(t("toast.moveUndo"), "success", action);
  window.setTimeout(() => { if (state.lastUndo === action) state.lastUndo = null; }, 7000);
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
  } else showToast(result.error || t("error.import"), "error");
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
    if (Array.from(event.dataTransfer.types).some((type) => type.startsWith("application/x-openapi-"))) return;
    const file = event.dataTransfer.files[0];
    if (file?.name.endsWith(".json")) await importCollection(file.path);
    else showToast(t("error.dropJson"), "error");
  });
}
// ── Utilidades ────────────────────────────────────────────────────────────
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}
