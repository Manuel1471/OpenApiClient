// renderer/assets/js/renderer.js - Lógica del renderer process

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Renderer process iniciado');
    
    // Verificar que electronAPI esté disponible
    if (window.electronAPI) {
        console.log('Electron API disponible');
        console.log('Plataforma:', window.electronAPI.platform);
        console.log('Versiones:', window.electronAPI.versions);
    } else {
        console.warn('Electron API no disponible');
    }

    // Cargar configuración
    let config = await window.electronAPI.getConfig();

    // Cargar componentes
    await loadComponents();
    
    // Actualizar mensaje de bienvenida después de cargar componentes
    updateWelcomeMessage(config);
    
    // Cargar colecciones guardadas
    await loadSavedCollections();
    
    // Inicializar funcionalidad de importación
    initImportFunctionality();
    
    // Escuchar cambios en la configuración
    if (window.electronAPI && window.electronAPI.onMessage) {
        window.electronAPI.onMessage('app-config-loaded', (newConfig) => {
            updateWelcomeMessage(newConfig);
        });
    }
});

// Función para actualizar el mensaje de bienvenida
function updateWelcomeMessage(config) {
    const userName = document.getElementById('userName');
    const userBadge = document.getElementById('userBadge');
    
    if (userName && config && config.user && config.user.name) {
        userName.textContent = config.user.name;
        if (userBadge) {
            userBadge.style.display = 'inline-flex';
        }
    } else if (userName) {
        userName.textContent = 'Usuario';
        if (userBadge) {
            userBadge.style.display = 'inline-flex';
        }
    } else if (userBadge) {
        userBadge.style.display = 'none';
    }
}

// Función para cargar todos los componentes
async function loadComponents() {
    try {
        // Cargar TopBar
        await ComponentLoader.loadComponentIntoElement('TopBar', 'topBarContainer');
        
        // Cargar Sidebar
        await ComponentLoader.loadComponentIntoElement('Sidebar', 'sidebarContainer');
        
        // Cargar RequestBar
        await ComponentLoader.loadComponentIntoElement('RequestBar', 'requestBarContainer');
        
        // Cargar RequestTabs
        await ComponentLoader.loadComponentIntoElement('RequestTabs', 'requestTabsContainer');
        
        // Cargar TabContent
        await ComponentLoader.loadComponentIntoElement('TabContent', 'tabContentContainer');
        
        // Cargar ResponseSection
        await ComponentLoader.loadComponentIntoElement('ResponseSection', 'responseSectionContainer');
        
        console.log('Todos los componentes cargados exitosamente');
        
        // Inicializar menú de colecciones después de cargar componentes
        initCollectionsMenu();
        
        // Inicializar estados vacíos
        initEmptyStates();
    } catch (error) {
        console.error('Error al cargar componentes:', error);
    }
}

// Función para inicializar el menú de colecciones
function initCollectionsMenu() {
    const menuTrigger = document.getElementById('collectionsMenuTrigger');
    const collectionsMenu = document.getElementById('collectionsMenu');
    
    if (menuTrigger && collectionsMenu) {
        // Abrir/cerrar menú al hacer clic en el trigger
        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            collectionsMenu.classList.toggle('show');
        });
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!collectionsMenu.contains(e.target) && e.target !== menuTrigger) {
                collectionsMenu.classList.remove('show');
            }
        });
        
        // Cerrar menú al hacer clic en un item
        const menuItems = collectionsMenu.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                collectionsMenu.classList.remove('show');
            });
        });
    }
}

// Función para inicializar estados vacíos
function initEmptyStates() {
    // Verificar si hay colecciones
    updateCollectionsEmptyState();
    
    // Mostrar estado vacío de request inicialmente
    const emptyRequestState = document.getElementById('emptyRequestState');
    const requestContent = document.getElementById('requestContent');
    
    if (emptyRequestState && requestContent) {
        emptyRequestState.classList.remove('hidden');
        requestContent.style.display = 'none';
    }
}

// Función para actualizar el estado vacío de colecciones
function updateCollectionsEmptyState() {
    const collectionsList = document.getElementById('collectionsList');
    const emptyCollections = document.getElementById('emptyCollections');
    
    if (collectionsList && emptyCollections) {
        // Contar elementos reales (excluyendo el empty state)
        const realChildren = Array.from(collectionsList.children).filter(
            child => child.nodeType === 1 && 
                     child.tagName && 
                     !child.classList.contains('empty-collections') &&
                     child.classList.contains('collection-container')
        );
        
        const hasCollections = realChildren.length > 0;
        
        if (hasCollections) {
            emptyCollections.classList.add('hidden');
        } else {
            emptyCollections.classList.remove('hidden');
        }
    }
}

// Función para mostrar el contenido de request
function showRequestContent() {
    const emptyRequestState = document.getElementById('emptyRequestState');
    const requestContent = document.getElementById('requestContent');
    
    if (emptyRequestState && requestContent) {
        emptyRequestState.classList.add('hidden');
        requestContent.style.display = 'flex';
    }
}

// Función para ocultar el contenido de request
function hideRequestContent() {
    const emptyRequestState = document.getElementById('emptyRequestState');
    const requestContent = document.getElementById('requestContent');
    
    if (emptyRequestState && requestContent) {
        emptyRequestState.classList.remove('hidden');
        requestContent.style.display = 'none';
    }
}

// Función para cargar colecciones guardadas
async function loadSavedCollections() {
    try {
        const result = await window.electronAPI.loadAllCollections();
        if (result.success && result.collections) {
            renderCollections(result.collections);
        }
    } catch (error) {
        console.error('Error al cargar colecciones:', error);
    }
}

// Función para renderizar colecciones en el sidebar
function renderCollections(collections) {
    const collectionsList = document.getElementById('collectionsList');
    if (!collectionsList) return;
    
    // Limpiar lista actual (excepto el empty state)
    const emptyCollections = document.getElementById('emptyCollections');
    const existingItems = Array.from(collectionsList.children).filter(
        child => child !== emptyCollections
    );
    existingItems.forEach(item => item.remove());
    
    // Agregar cada colección
    collections.forEach(collection => {
        const collectionItem = createCollectionItem(collection);
        collectionsList.insertBefore(collectionItem, emptyCollections);
    });
    
    // Actualizar estado vacío
    updateCollectionsEmptyState();
}

// Función para crear un elemento de colección
function createCollectionItem(collection) {
    const container = document.createElement('div');
    container.className = 'collection-container';
    container.dataset.path = collection.path;
    
    const name = collection.name || collection.info?.name || 'Colección sin nombre';
    
    // Crear el header de la colección
    const header = document.createElement('div');
    header.className = 'collection-item';
    header.innerHTML = `
        <span class="collection-name">${escapeHtml(name)}</span>
    `;
    
    // Crear contenedor para las requests (inicialmente oculto)
    const requestsContainer = document.createElement('div');
    requestsContainer.className = 'collection-requests';
    requestsContainer.style.display = 'none';
    
    // Agregar las requests si existen
    if (collection.requests && collection.requests.length > 0) {
        collection.requests.forEach((request, index) => {
            const requestItem = createRequestItem(request, collection.path, index);
            requestsContainer.appendChild(requestItem);
        });
    }
    
    // Agregar evento de clic para expandir/colapsar
    header.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollection(container, requestsContainer);
    });
    
    container.appendChild(header);
    container.appendChild(requestsContainer);
    
    return container;
}

// Función para crear un item de request
function createRequestItem(request, collectionPath, index) {
    const item = document.createElement('div');
    item.className = 'request-item';
    item.dataset.collectionPath = collectionPath;
    item.dataset.requestIndex = index;
    
    const method = request.method || 'GET';
    const name = request.name || 'Request sin nombre';
    
    // Color según el método HTTP
    const methodColors = {
        'GET': '#61affe',
        'POST': '#49cc90',
        'PUT': '#fca130',
        'PATCH': '#50e3c2',
        'DELETE': '#f93e3e',
        'HEAD': '#9012fe',
        'OPTIONS': '#0d5aa7'
    };
    
    const methodColor = methodColors[method.toUpperCase()] || '#858585';
    
    item.innerHTML = `
        <span class="request-method" style="background-color: ${methodColor}">${escapeHtml(method)}</span>
        <span class="request-name">${escapeHtml(name)}</span>
    `;
    
    // Agregar evento de clic para cargar la request
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        loadRequest(request, collectionPath);
    });
    
    return item;
}

// Función para expandir/colapsar colección
function toggleCollection(container, requestsContainer) {
    const isExpanded = requestsContainer.style.display !== 'none';
    
    if (isExpanded) {
        requestsContainer.style.display = 'none';
        container.classList.remove('expanded');
    } else {
        requestsContainer.style.display = 'block';
        container.classList.add('expanded');
    }
}

// Función para cargar una request específica
function loadRequest(request, collectionPath) {
    console.log('Cargando request:', request);
    // TODO: Implementar lógica para mostrar la request en el área de request
    showRequestContent();
}

// Función para escapar HTML (prevenir XSS)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// Función para inicializar funcionalidad de importación
function initImportFunctionality() {
    // Botón de importar en el menú
    const importFileBtn = document.getElementById('importFileBtn');
    if (importFileBtn) {
        importFileBtn.addEventListener('click', handleImportFile);
    }
    
    // Drag & drop en el sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        initDragAndDrop(sidebar);
    }
}

// Función para manejar importación de archivo
async function handleImportFile() {
    try {
        // Seleccionar archivo
        const filePath = await window.electronAPI.selectFile();
        if (!filePath) return;
        
        // Importar colección
        await importCollection(filePath);
    } catch (error) {
        console.error('Error al importar archivo:', error);
    }
}

// Función para importar una colección
async function importCollection(filePath) {
    try {
        const result = await window.electronAPI.importCollection(filePath);
        if (result.success) {
            // Recargar colecciones
            await loadSavedCollections();
            console.log('Colección importada exitosamente');
        } else {
            console.error('Error al importar:', result.error);
        }
    } catch (error) {
        console.error('Error al importar colección:', error);
    }
}

// Función para inicializar drag & drop
function initDragAndDrop(element) {
    // Prevenir comportamiento por defecto
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        element.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Agregar clase visual cuando se arrastra sobre el elemento
    ['dragenter', 'dragover'].forEach(eventName => {
        element.addEventListener(eventName, () => {
            element.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        element.addEventListener(eventName, () => {
            element.classList.remove('drag-over');
        }, false);
    });
    
    // Manejar drop
    element.addEventListener('drop', async (e) => {
        const files = e.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0];
            
            // Verificar que sea un archivo JSON
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                // En Electron, los archivos arrastrados tienen la propiedad 'path'
                const filePath = file.path || file.name;
                
                if (filePath) {
                    await importCollection(filePath);
                } else {
                    console.warn('No se pudo obtener la ruta del archivo');
                }
            } else {
                console.warn('Solo se pueden importar archivos JSON');
            }
        }
    }, false);
}

