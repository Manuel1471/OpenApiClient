// main/handlers/configHandlers.js - Handlers IPC para configuración
const { ipcMain } = require('electron');
const configService = require('../../src/services/configService');

let appConfig;

// Inicializar con la configuración cargada
function initConfigHandlers(config) {
  appConfig = config;
}

// Handler para obtener configuración
ipcMain.handle('get-config', async () => {
  if (!appConfig) {
    appConfig = await configService.load();
  }
  return appConfig;
});

// Handler para guardar configuración
ipcMain.handle('save-config', async (event, config) => {
  const result = await configService.save(config);
  if (result.success) {
    appConfig = config;
  }
  return result;
});

// Handler para resetear configuración
ipcMain.handle('reset-config', async () => {
  const result = await configService.reset();
  if (result.success) {
    appConfig = await configService.load();
  }
  return result;
});

// Función para actualizar la configuración en memoria
function updateConfig(config) {
  appConfig = config;
}

// Función para obtener la configuración actual
function getConfig() {
  return appConfig;
}

module.exports = {
  initConfigHandlers,
  updateConfig,
  getConfig
};

