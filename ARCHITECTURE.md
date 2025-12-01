# Arquitectura del Proyecto - OpenAPI Client

Esta documentación describe la estructura de archivos y organización del proyecto Electron.

## 📁 Estructura de Directorios

```
OpenApiClient/
├── main/                    # Proceso principal de Electron (Main Process)
│   └── main.js             # Punto de entrada principal, manejo de ventanas
│
├── renderer/                # Proceso de renderizado (Renderer Process)
│   ├── index.html          # HTML principal de la aplicación
│   ├── preload/            # Scripts de preload (seguridad)
│   │   └── preload.js      # Bridge seguro entre main y renderer
│   └── assets/             # Recursos estáticos
│       ├── css/            # Estilos CSS
│       │   └── main.css
│       ├── js/             # Scripts del renderer
│       │   └── renderer.js
│       └── images/         # Imágenes (crear cuando sea necesario)
│
├── src/                     # Código compartido y lógica de negocio
│   ├── utils/              # Utilidades y helpers
│   │   └── constants.js    # Constantes de la aplicación
│   └── services/           # Servicios (API, base de datos, etc.)
│       └── apiService.js   # Ejemplo de servicio API
│
├── package.json            # Configuración del proyecto
├── index.js                # ⚠️ Archivo antiguo (puede eliminarse)
└── index.html              # ⚠️ Archivo antiguo (puede eliminarse)
```

## 🔐 Seguridad

La arquitectura implementa las mejores prácticas de seguridad de Electron:

- **Context Isolation**: Habilitado para aislar el código del renderer
- **Node Integration**: Deshabilitado en el renderer
- **Preload Script**: Bridge seguro para comunicación entre procesos
- **IPC Whitelist**: Solo canales permitidos pueden comunicarse

## 🔄 Flujo de Comunicación

```
Main Process (main/main.js)
    ↕ IPC (Inter-Process Communication)
Preload Script (renderer/preload/preload.js)
    ↕ contextBridge
Renderer Process (renderer/assets/js/renderer.js)
```

## 📝 Convenciones

### Nombres de Archivos
- **main/**: Archivos del proceso principal
- **renderer/**: Archivos del proceso de renderizado
- **src/**: Código compartido que puede usarse en ambos procesos

### Comunicación IPC
- Usar canales definidos en `src/utils/constants.js`
- Validar canales en el preload script
- Usar `contextBridge` para exponer APIs seguras

## 🚀 Desarrollo

### Agregar Nuevas Funcionalidades

1. **Nuevas ventanas**: Crear funciones en `main/main.js`
2. **Nuevos componentes UI**: Agregar en `renderer/assets/js/`
3. **Nuevos estilos**: Agregar en `renderer/assets/css/`
4. **Nuevos servicios**: Crear en `src/services/`
5. **Nuevas utilidades**: Agregar en `src/utils/`

### Comunicación entre Procesos

**Desde Renderer → Main:**
```javascript
// En renderer/assets/js/renderer.js
window.electronAPI.sendMessage('app:message', { data: 'hello' });
```

**Desde Main → Renderer:**
```javascript
// En main/main.js
mainWindow.webContents.send('app:notification', { data: 'hello' });
```

## 📦 Próximos Pasos

- [ ] Agregar sistema de build (webpack/vite)
- [ ] Configurar hot-reload para desarrollo
- [ ] Agregar tests unitarios
- [ ] Configurar CI/CD
- [ ] Agregar sistema de logging
- [ ] Implementar actualizaciones automáticas

