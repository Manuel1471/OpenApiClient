// src/utils/constants.js - Constantes de la aplicación

module.exports = {
  APP_NAME: 'OpenAPI Client',
  APP_VERSION: '1.0.0',
  
  // Configuración de ventana
  WINDOW: {
    DEFAULT_WIDTH: 1200,
    DEFAULT_HEIGHT: 800,
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600
  },
  
  // Canales IPC
  IPC_CHANNELS: {
    MESSAGE: 'app:message',
    REQUEST: 'app:request',
    RESPONSE: 'app:response',
    NOTIFICATION: 'app:notification',
    INVOKE: 'app:invoke'
  }
};

