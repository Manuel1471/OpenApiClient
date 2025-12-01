// main/handlers/index.js - Registro centralizado de todos los handlers IPC
const configHandlers = require('./configHandlers');
const fileHandlers = require('./fileHandlers');
const collectionHandlers = require('./collectionHandlers');

/**
 * Inicializa todos los handlers IPC
 * @param {Object} config - Configuración inicial de la aplicación
 */
function initHandlers(config) {
  // Inicializar handlers de configuración con la config inicial
  configHandlers.initConfigHandlers(config);
  
  // Los demás handlers se registran automáticamente al importar
  // porque usan ipcMain.handle directamente
  
  console.log('Handlers IPC registrados correctamente');
}

/**
 * Obtiene la configuración actual desde los handlers
 */
function getConfig() {
  return configHandlers.getConfig();
}

/**
 * Actualiza la configuración en los handlers
 */
function updateConfig(config) {
  configHandlers.updateConfig(config);
}

module.exports = {
  initHandlers,
  getConfig,
  updateConfig
};

