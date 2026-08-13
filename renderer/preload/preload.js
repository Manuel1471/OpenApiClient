// renderer/preload/preload.js - Script de preload para comunicación segura
const { contextBridge, ipcRenderer } = require("electron");

// Exponer APIs protegidas al renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // Ejemplo: enviar mensaje al proceso principal
  sendMessage: (channel, data) => {
    // Whitelist de canales permitidos
    const validChannels = ["app:message", "app:request"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Ejemplo: recibir mensaje del proceso principal
  onMessage: (channel, callback) => {
    const validChannels = ["app:response", "app:notification"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Ejemplo: invocación con respuesta
  invoke: (channel, data) => {
    const validChannels = ["app:invoke"];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },

  // Seleccionar archivo del sistema
  selectFile: async () => {
    return await ipcRenderer.invoke("select-file");
  },
  selectUploadFiles: async () => ipcRenderer.invoke("select-upload-file"),
  selectProtoFile: async () => ipcRenderer.invoke("select-proto-file"),
  selectDirectory: async () => ipcRenderer.invoke("select-directory"),

  // Leer contenido de un archivo
  readFile: async (filePath) => {
    return await ipcRenderer.invoke("read-file", filePath);
  },

  // Crear y guardar archivo de colecciones
  createCollection: async (collection) => {
    return await ipcRenderer.invoke("create-collection", collection);
  },

  // Configuración
  getConfig: async () => {
    return await ipcRenderer.invoke("get-config");
  },

  saveConfig: async (config) => {
    return await ipcRenderer.invoke("save-config", config);
  },

  resetConfig: async () => {
    return await ipcRenderer.invoke("reset-config");
  },

  importCollection: async (filePath) => {
    return await ipcRenderer.invoke("import-collection", filePath);
  },

  // Cargar todas las colecciones desde los paths guardados
  loadAllCollections: async () => {
    return await ipcRenderer.invoke("load-all-collections");
  },

  updateCollection: async (filePath, collection) => {
    return await ipcRenderer.invoke("update-collection", filePath, collection);
  },
  renameCollection: async (filePath, name) =>
    ipcRenderer.invoke("rename-collection", filePath, name),
  removeCollection: async (filePath) =>
    ipcRenderer.invoke("remove-collection", filePath),
  exportCollection: async (collection) =>
    ipcRenderer.invoke("export-collection", collection),

  executeRequest: async (request) => {
    return await ipcRenderer.invoke("execute-request", request);
  },
  cancelRequest: async (requestId) =>
    ipcRenderer.invoke("cancel-request", requestId),
  connectWebSocket: (request) => ipcRenderer.invoke("websocket-connect", request),
  sendWebSocket: (request) => ipcRenderer.invoke("websocket-send", request),
  closeWebSocket: (id) => ipcRenderer.invoke("websocket-close", id),
  grpcCall: (request) => ipcRenderer.invoke("grpc-call", request),
  onWebSocketMessage: (callback) => ipcRenderer.on("websocket-message", (_, message) => callback(message)),
  onWebSocketStatus: (callback) => ipcRenderer.on("websocket-status", (_, status) => callback(status)),
  gitStatus: (directory) => ipcRenderer.invoke("git-status", directory),
  gitInit: (directory) => ipcRenderer.invoke("git-init", directory),
  gitCommit: (data) => ipcRenderer.invoke("git-commit", data),
  gitBranch: (directory) => ipcRenderer.invoke("git-branch", directory),
  gitHistory: (directory) => ipcRenderer.invoke("git-history", directory),
  gitFetch: (directory) => ipcRenderer.invoke("git-fetch", directory),
  gitPull: (directory) => ipcRenderer.invoke("git-pull", directory),
  gitPush: (directory) => ipcRenderer.invoke("git-push", directory),

  // Obtener la lista de colecciones
  // Información del sistema (si es necesario)
  platform: process.platform,
  versions: process.versions,
});

// Log para desarrollo
console.log("Preload script cargado correctamente");
