// main/handlers/collectionHandlers.js - Handlers IPC para colecciones
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const configService = require('../../src/services/configService');

// Handler para crear y guardar archivo de colecciones
ipcMain.handle('create-collection', async (event, collections) => {
  try {
    // Mostrar diálogo para guardar archivo
    const result = await dialog.showSaveDialog({
      title: 'Guardar Colección',
      defaultPath: 'mi-coleccion.json',
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ],
      buttonLabel: 'Guardar'
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Operación cancelada' };
    }
    
    // Asegurar que el archivo tenga extensión .json
    let filePath = result.filePath;
    if (!filePath.endsWith('.json')) {
      filePath += '.json';
    }
    
    // Crear estructura de colección si no viene completa
    const collectionData = {
      info: {
        name: collections.name || 'Mi Colección',
        description: collections.description || '',
        version: collections.version || '1.0.0',
        createdAt: new Date().toISOString()
      },
      collections: collections.collections || [],
      requests: collections.requests || []
    };
    
    // Convertir a JSON con formato legible
    const jsonContent = JSON.stringify(collectionData, null, 2);
    
    // Escribir el archivo
    await fs.writeFile(filePath, jsonContent, 'utf-8');
    
    return { 
      success: true, 
      message: 'Colección guardada exitosamente',
      path: filePath 
    };
  } catch (error) {
    console.error('Error al guardar colección:', error);
    return { 
      success: false, 
      error: error.message,
      message: `Error al guardar: ${error.message}`
    };
  }
});

// Handler para agregar nueva request a una colección
ipcMain.handle('add-new-http-request-to-collection', async (event, request) => {
  try {
    const collection = await fs.readFile(request.collectionPath, 'utf-8');
    return { success: true, collection };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para cargar colección desde archivo
ipcMain.handle('load-collection', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const collection = JSON.parse(content);
    return { success: true, collection, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para actualizar colección
ipcMain.handle('update-collection', async (event, filePath, collectionData) => {
  try {
    const jsonContent = JSON.stringify(collectionData, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para importar colección y guardar el path en la configuración
ipcMain.handle('import-collection', async (event, filePath) => {
  try {
    // Leer el archivo de colección
    const content = await fs.readFile(filePath, 'utf-8');
    const collection = JSON.parse(content);
    
    // Cargar configuración actual
    const config = await configService.load();
    
    // Verificar si el path ya existe en las colecciones
    const existingIndex = config.collections.findIndex(c => c.path === filePath);
    
    if (existingIndex === -1) {
      // Agregar nueva colección al config
      config.collections.push({
        path: filePath,
        name: collection.info?.name || collection.name || 'Colección sin nombre',
        lastLoaded: new Date().toISOString()
      });
      
      // Guardar configuración actualizada
      await configService.save(config);
    }
    
    return { success: true, collection, path: filePath };
  } catch (error) {
    console.error('Error al importar colección:', error);
    return { success: false, error: error.message };
  }
});

// Handler para cargar todas las colecciones desde los paths guardados
ipcMain.handle('load-all-collections', async () => {
  try {
    const config = await configService.load();
    const collections = [];
    
    // Cargar cada colección desde su path
    for (const collectionInfo of config.collections || []) {
      try {
        const content = await fs.readFile(collectionInfo.path, 'utf-8');
        const collection = JSON.parse(content);
        collections.push({
          ...collection,
          path: collectionInfo.path,
          name: collectionInfo.name || collection.info?.name || 'Colección sin nombre'
        });
      } catch (error) {
        console.warn(`No se pudo cargar colección en ${collectionInfo.path}:`, error.message);
        // Continuar con las demás colecciones aunque una falle
      }
    }
    
    return { success: true, collections };
  } catch (error) {
    console.error('Error al cargar colecciones:', error);
    return { success: false, error: error.message, collections: [] };
  }
});

// Los handlers se registran automáticamente con ipcMain.handle
// No necesitamos exportar nada, pero mantenemos el export para compatibilidad
module.exports = {};

