// main/handlers/fileHandlers.js - Handlers IPC para operaciones de archivos
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;

// Handler para seleccionar archivo
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'YAML', extensions: ['yaml', 'yml'] },
      { name: 'OpenAPI', extensions: ['json', 'yaml', 'yml'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handler para leer el contenido de un archivo
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para escribir un archivo
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para seleccionar directorio
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

module.exports = {};

