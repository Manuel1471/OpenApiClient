// src/services/configService.js
const fs = require("fs").promises;
const path = require("path");
const { app } = require("electron");

class ConfigService {
  constructor() {
    // Archivo default (dentro del bundle de la app)
    // En desarrollo: src/config/default-config.json
    // En producción: dentro del .app/.exe (no visible para usuarios)
    // __dirname apunta a src/services/ tanto en desarrollo como en producción
    // Entonces ../config/default-config.json funciona en ambos casos
    this.defaultConfigPath = path.join(
      __dirname,
      "../config/default-config.json",
    );

    // Archivo de usuario (en el directorio de datos de Electron)
    // macOS: ~/Library/Application Support/OpenAPI Client/config.json
    // Windows: %APPDATA%/OpenAPI Client/config.json
    // Linux: ~/.config/OpenAPI Client/config.json
    this.userConfigPath = path.join(app.getPath("userData"), "config.json");

    this.config = null;
  }

  // Cargar configuración (solo archivo de usuario, o default si no existe)
  async load() {
    try {
      // Intentar cargar configuración de usuario
      let userConfig;
      try {
        const userContent = await fs.readFile(this.userConfigPath, "utf-8");
        userConfig = this.restoreSecrets(JSON.parse(userContent));

        // Verificar si necesita migración ANTES de migrar
        if (this.needsMigration(userConfig)) {
          console.log(
            "Migrando configuración de estructura antigua a nueva...",
          );
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
          const defaultContent = await fs.readFile(
            this.defaultConfigPath,
            "utf-8",
          );
          defaultConfig = JSON.parse(defaultContent);
        } catch (error) {
          console.warn(
            "No se encontró configuración por defecto, usando valores predeterminados",
          );
          defaultConfig = this.getDefaultConfig();
        }

        // Crear el archivo de usuario con la configuración por defecto
        console.log("Creando archivo de configuración de usuario...");
        await this.save(defaultConfig);
        this.config = defaultConfig;
        return this.config;
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error);
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

      // Never write plain-text secrets: encrypt tokens before persisting config.
      const configToSave = structuredClone(config);
      this.protectSecrets(configToSave);
      const content = JSON.stringify(configToSave, null, 2);
      await fs.writeFile(this.userConfigPath, content, "utf-8");

      this.config = config;
      return { success: true, path: this.userConfigPath };
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      return { success: false, error: error.message };
    }
  }

  protectSecrets(config) {
    // Encryption happens in Electron's main process with the OS keychain.
    // A future login feature can reuse this mechanism for its session tokens.
    const { safeStorage } = require("electron");
    if (!safeStorage.isEncryptionAvailable()) return;
    (config.environments || []).forEach((environment) => {
      const token = environment.variables?.token;
      if (token && !environment.variables.encryptedToken) {
        environment.variables.encryptedToken = safeStorage
          .encryptString(token)
          .toString("base64");
        delete environment.variables.token;
      }
    });
  }

  restoreSecrets(config) {
    const { safeStorage } = require("electron");
    if (!safeStorage.isEncryptionAvailable()) return config;
    (config.environments || []).forEach((environment) => {
      const encrypted = environment.variables?.encryptedToken;
      if (encrypted) {
        try {
          environment.variables.token = safeStorage.decryptString(
            Buffer.from(encrypted, "base64"),
          );
        } catch {
          environment.variables.token = "";
        }
      }
    });
    return config;
  }

  // Resetear a configuración por defecto
  async reset() {
    try {
      const defaultContent = await fs.readFile(this.defaultConfigPath, "utf-8");
      const defaultConfig = JSON.parse(defaultContent);
      return await this.save(defaultConfig);
    } catch (error) {
      console.error("Error al resetear configuración:", error);
      return { success: false, error: error.message };
    }
  }

  // Configuración por defecto (fallback)
  getDefaultConfig() {
    return {
      user: {
        name: "Usuario",
      },
      authentication: {
        enabled: false,
        provider: null,
        session: null,
      },
      collections: [],
      environments: [
        {
          id: "local",
          name: "Local",
          variables: { baseUrl: "http://localhost:3000", token: "" },
        },
        {
          id: "staging",
          name: "Staging",
          variables: { baseUrl: "", token: "" },
        },
        {
          id: "production",
          name: "Producción",
          variables: { baseUrl: "", token: "" },
        },
      ],
      activeEnvironmentId: "local",
      history: [],
      language: "es",
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
        ...config,
        user: {
          name: config.config.name_account || "Usuario",
        },
        collections: config.collections || [],
      };
    }

    // Si ya tiene user pero también tiene config antiguo, limpiar
    if (config.user && config.config) {
      return {
        ...config,
        user: config.user,
        collections: config.collections || [],
      };
    }

    // Si ya está en la nueva estructura, retornar tal cual
    return config;
  }
}

module.exports = new ConfigService();
