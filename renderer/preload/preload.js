// renderer/preload/preload.js - Script de preload para comunicación segura
const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs protegidas al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Ejemplo: enviar mensaje al proceso principal
  sendMessage: (channel, data) => {
    // Whitelist de canales permitidos
    const validChannels = ['app:message', 'app:request'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // Ejemplo: recibir mensaje del proceso principal
  onMessage: (channel, callback) => {
    const validChannels = ['app:response', 'app:notification'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  // Ejemplo: invocación con respuesta
  invoke: (channel, data) => {
    const validChannels = ['app:invoke'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },
  
  // Seleccionar archivo del sistema
  selectFile: async () => {
    return await ipcRenderer.invoke('select-file');
  },
  
  // Leer contenido de un archivo
  readFile: async (filePath) => {
    return await ipcRenderer.invoke('read-file', filePath);
  },
  
  // Crear y guardar archivo de colecciones
  createCollections: async (collections) => {
    return await ipcRenderer.invoke('create-collections', collections);
  },
  
  // Configuración
  getConfig: async () => {
    return await ipcRenderer.invoke('get-config');
  },
  
  saveConfig: async (config) => {
    return await ipcRenderer.invoke('save-config', config);
  },
  
  resetConfig: async () => {
    return await ipcRenderer.invoke('reset-config');
  },
  
  importCollection: async (filePath) => {
    return await ipcRenderer.invoke('import-collection', filePath);
  },

  // Cargar todas las colecciones desde los paths guardados
  loadAllCollections: async () => {
    return await ipcRenderer.invoke('load-all-collections');
  },

  // Obtener la lista de colecciones
  // Información del sistema (si es necesario)
  platform: process.platform,
  versions: process.versions
});

// Log para desarrollo
console.log('Preload script cargado correctamente');

