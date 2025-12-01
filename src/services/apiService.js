// src/services/apiService.js - Servicio para manejar llamadas API
// Este es un ejemplo de cómo organizar servicios

class ApiService {
  constructor() {
    this.baseURL = '';
  }
  
  async makeRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en la petición API:', error);
      throw error;
    }
  }
}

module.exports = ApiService;

