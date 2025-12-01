// ComponentLoader.js - Cargador de componentes
class ComponentLoader {
    static async loadComponent(componentName) {
        try {
            const response = await fetch(`components/${componentName}.html`);
            if (!response.ok) {
                throw new Error(`No se pudo cargar el componente: ${componentName}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`Error al cargar componente ${componentName}:`, error);
            return '';
        }
    }

    static async loadComponentIntoElement(componentName, targetElementId) {
        const html = await this.loadComponent(componentName);
        const targetElement = document.getElementById(targetElementId);
        if (targetElement) {
            targetElement.innerHTML = html;
        } else {
            console.error(`Elemento con ID ${targetElementId} no encontrado`);
        }
    }

    static async loadComponentIntoSelector(componentName, selector) {
        const html = await this.loadComponent(componentName);
        const targetElement = document.querySelector(selector);
        if (targetElement) {
            targetElement.innerHTML = html;
        } else {
            console.error(`Elemento con selector ${selector} no encontrado`);
        }
    }
}

