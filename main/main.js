// main/main.js - Proceso principal de Electron
const { app, BrowserWindow } = require('electron');
const path = require('path');
const configService = require('../src/services/configService');
const { initHandlers, updateConfig } = require('./handlers');

// Configuración de la aplicación
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Seguridad: deshabilitar nodeIntegration en el renderer
      nodeIntegration: false,
      // Seguridad: habilitar contextIsolation
      contextIsolation: true,
      // Script de preload para comunicación segura
      preload: path.join(__dirname, '../renderer/preload/preload.js'),
      // Deshabilitar remote module (deprecated y no seguro)
      enableRemoteModule: false
    },
    icon: path.join(__dirname, '../renderer/assets/icon.png'), // Opcional: icono de la app
    show: false // No mostrar hasta que esté listo
  });

  // Cargar el archivo HTML
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Abrir DevTools solo en desarrollo
    //if (isDev) {
    //  mainWindow.webContents.openDevTools();
    //}
  });

  // Enviar configuración al renderer cuando esté listo
  mainWindow.webContents.once('did-finish-load', () => {
    const { getConfig } = require('./handlers');
    const config = getConfig();
    if (config) {
      mainWindow.webContents.send('app-config-loaded', config);
    }
  });

  // Manejar cierre de ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Los handlers IPC están organizados en main/handlers/
// Se registran automáticamente al importar los módulos

// Este método se llamará cuando Electron haya terminado de inicializar
app.whenReady().then(async () => {
  // Cargar configuración al iniciar
  const appConfig = await configService.load();
  console.log('Configuración cargada:', appConfig);
  console.log('Archivo de usuario:', configService.getUserConfigPath());
  
  // Inicializar todos los handlers IPC con la configuración
  initHandlers(appConfig);
  
  createWindow();

  app.on('activate', () => {
    // En macOS, recrear ventana cuando se hace clic en el icono del dock
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Salir cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
  // En macOS, las aplicaciones normalmente permanecen activas
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Manejar cierre de la aplicación
app.on('before-quit', () => {
  // Limpiar recursos si es necesario
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

