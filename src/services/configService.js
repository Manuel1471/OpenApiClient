// src/services/configService.js
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class ConfigService {
  constructor() {
    // Archivo default (dentro del bundle de la app)
    // En desarrollo: src/config/default-config.json
    // En producción: dentro del .app/.exe (no visible para usuarios)
    // __dirname apunta a src/services/ tanto en desarrollo como en producción
    // Entonces ../config/default-config.json funciona en ambos casos
    this.defaultConfigPath = path.join(__dirname, '../config/default-config.json');
    
    // Archivo de usuario (en el directorio de datos de Electron)
    // macOS: ~/Library/Application Support/OpenAPI Client/config.json
    // Windows: %APPDATA%/OpenAPI Client/config.json
    // Linux: ~/.config/OpenAPI Client/config.json
    this.userConfigPath = path.join(app.getPath('userData'), 'config.json');
    
    this.config = null;
  }

  // Cargar configuración (solo archivo de usuario, o default si no existe)
  async load() {
    try {
      // Intentar cargar configuración de usuario
      let userConfig;
      try {
        const userContent = await fs.readFile(this.userConfigPath, 'utf-8');
        userConfig = JSON.parse(userContent);
        
        // Verificar si necesita migración ANTES de migrar
        if (this.needsMigration(userConfig)) {
          console.log('Migrando configuración de estructura antigua a nueva...');
          // Migrar estructura antigua a nueva
          userConfig = this.migrateConfig(userConfig);
          // Guardar la configuración migrada
          await this.save(userConfig);
        } else if (userConfig.user && userConfig.config) {
          // Si tiene ambas estructuras, limpiar la antigua
          userConfig = this.migrateConfig(userConfig);
          await this.save(userConfig);
        }
        
        // Usar directamente la configuración del usuario
        this.config = userConfig;
        return this.config;
      } catch (error) {
        // Si no existe el archivo de usuario, cargar default y crearlo
        let defaultConfig;
        try {
          const defaultContent = await fs.readFile(this.defaultConfigPath, 'utf-8');
          defaultConfig = JSON.parse(defaultContent);
        } catch (error) {
          console.warn('No se encontró configuración por defecto, usando valores predeterminados');
          defaultConfig = this.getDefaultConfig();
        }
        
        // Crear el archivo de usuario con la configuración por defecto
        console.log('Creando archivo de configuración de usuario...');
        await this.save(defaultConfig);
        this.config = defaultConfig;
        return this.config;
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  // Obtener configuración actual
  getConfig() {
    return this.config || this.getDefaultConfig();
  }

  // Guardar configuración de usuario
  async save(config) {
    try {
      // Asegurar que el directorio existe
      const userDataDir = path.dirname(this.userConfigPath);
      await fs.mkdir(userDataDir, { recursive: true });

      // Guardar solo la configuración de usuario
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this.userConfigPath, content, 'utf-8');
      
      this.config = config;
      return { success: true, path: this.userConfigPath };
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      return { success: false, error: error.message };
    }
  }

  // Resetear a configuración por defecto
  async reset() {
    try {
      const defaultContent = await fs.readFile(this.defaultConfigPath, 'utf-8');
      const defaultConfig = JSON.parse(defaultContent);
      return await this.save(defaultConfig);
    } catch (error) {
      console.error('Error al resetear configuración:', error);
      return { success: false, error: error.message };
    }
  }

  // Configuración por defecto (fallback)
  getDefaultConfig() {
    return {
      user: {
        name: 'Usuario'
      },
      collections: []
    };
  }

  // Obtener ruta del archivo de usuario
  getUserConfigPath() {
    return this.userConfigPath;
  }

  // Verificar si la configuración necesita migración
  needsMigration(config) {
    // Si tiene la estructura antigua (config.name_account) pero no user.name
    return config.config && config.config.name_account && !config.user;
  }

  // Migrar configuración de estructura antigua a nueva
  migrateConfig(config) {
    // Si tiene estructura antigua, migrar
    if (this.needsMigration(config)) {
      return {
        user: {
          name: config.config.name_account || 'Usuario'
        },
        collections: config.collections || []
      };
    }
    
    // Si ya tiene user pero también tiene config antiguo, limpiar
    if (config.user && config.config) {
      return {
        user: config.user,
        collections: config.collections || []
      };
    }
    
    // Si ya está en la nueva estructura, retornar tal cual
    return config;
  }
}

module.exports = new ConfigService();