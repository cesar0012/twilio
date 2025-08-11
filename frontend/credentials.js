/**
 * CredentialsManager - Gestión segura de credenciales
 * Maneja el almacenamiento y recuperación de credenciales de Twilio
 */

class CredentialsManager {
    constructor() {
        this.storageKey = 'twilio_credentials';
        this.encryptionKey = 'twilio_app_key_2024';
    }

    /**
     * Codifica las credenciales en base64
     */
    encodeCredentials(credentials) {
        try {
            const jsonString = JSON.stringify(credentials);
            return btoa(jsonString);
        } catch (error) {
            console.error('Error encoding credentials:', error);
            return null;
        }
    }

    /**
     * Decodifica las credenciales desde base64
     */
    decodeCredentials(encodedCredentials) {
        try {
            const jsonString = atob(encodedCredentials);
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Error decoding credentials:', error);
            return null;
        }
    }

    /**
     * Guarda las credenciales en localStorage
     */
    saveCredentials(credentials) {
        try {
            // Validar credenciales
            if (!this.validateCredentials(credentials)) {
                throw new Error('Credenciales inválidas');
            }

            // Codificar y guardar
            const encoded = this.encodeCredentials(credentials);
            if (encoded) {
                localStorage.setItem(this.storageKey, encoded);
                console.log('Credenciales guardadas exitosamente');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error saving credentials:', error);
            return false;
        }
    }

    /**
     * Recupera las credenciales desde localStorage
     */
    getCredentials() {
        try {
            const encoded = localStorage.getItem(this.storageKey);
            if (!encoded) {
                return null;
            }

            const credentials = this.decodeCredentials(encoded);
            if (credentials && this.validateCredentials(credentials)) {
                return credentials;
            }
            
            // Si las credenciales son inválidas, las eliminamos
            this.clearCredentials();
            return null;
        } catch (error) {
            console.error('Error getting credentials:', error);
            return null;
        }
    }

    /**
     * Elimina las credenciales del localStorage
     */
    clearCredentials() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('Credenciales eliminadas');
            return true;
        } catch (error) {
            console.error('Error clearing credentials:', error);
            return false;
        }
    }

    /**
     * Valida la estructura de las credenciales
     */
    validateCredentials(credentials) {
        if (!credentials || typeof credentials !== 'object') {
            return false;
        }

        const requiredFields = ['accountSid', 'authToken', 'twimlAppSid'];
        return requiredFields.every(field => {
            return credentials[field] && 
                   typeof credentials[field] === 'string' && 
                   credentials[field].trim().length > 0;
        });
    }

    /**
     * Verifica si existen credenciales válidas
     */
    hasValidCredentials() {
        const credentials = this.getCredentials();
        return credentials !== null;
    }

    /**
     * Obtiene las credenciales para mostrar en el formulario (sin datos sensibles)
     */
    getCredentialsForForm() {
        const credentials = this.getCredentials();
        if (!credentials) {
            return {
                accountSid: '',
                authToken: '',
                twimlAppSid: '',
                identity: ''
            };
        }

        return {
            accountSid: credentials.accountSid || '',
            authToken: credentials.authToken ? '••••••••••••••••' : '',
            twimlAppSid: credentials.twimlAppSid || '',
            identity: credentials.identity || ''
        };
    }

    /**
     * Actualiza credenciales existentes
     */
    updateCredentials(newCredentials) {
        const existingCredentials = this.getCredentials() || {};
        
        // Merge con credenciales existentes
        const updatedCredentials = {
            ...existingCredentials,
            ...newCredentials
        };

        return this.saveCredentials(updatedCredentials);
    }

    /**
     * Exporta credenciales para backup (codificadas)
     */
    exportCredentials() {
        const credentials = this.getCredentials();
        if (!credentials) {
            return null;
        }

        return {
            data: this.encodeCredentials(credentials),
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Importa credenciales desde backup
     */
    importCredentials(backupData) {
        try {
            if (!backupData || !backupData.data) {
                throw new Error('Datos de backup inválidos');
            }

            const credentials = this.decodeCredentials(backupData.data);
            if (!credentials) {
                throw new Error('No se pudieron decodificar las credenciales');
            }

            return this.saveCredentials(credentials);
        } catch (error) {
            console.error('Error importing credentials:', error);
            return false;
        }
    }

    /**
     * Genera un token de acceso temporal (para desarrollo)
     */
    generateAccessToken() {
        const credentials = this.getCredentials();
        if (!credentials) {
            return null;
        }

        // En un entorno real, esto se haría en el backend
        // Aquí es solo para propósitos de desarrollo
        const payload = {
            iss: credentials.accountSid,
            sub: credentials.identity || 'user',
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
            grants: {
                voice: {
                    outgoing: {
                        application_sid: credentials.twimlAppSid
                    },
                    incoming: {
                        allow: true
                    }
                }
            }
        };

        return btoa(JSON.stringify(payload));
    }

    /**
     * Obtiene estadísticas de uso de credenciales
     */
    getUsageStats() {
        const credentials = this.getCredentials();
        if (!credentials) {
            return null;
        }

        const stats = JSON.parse(localStorage.getItem('twilio_usage_stats') || '{}');
        return {
            lastUsed: stats.lastUsed || null,
            totalConnections: stats.totalConnections || 0,
            totalCalls: stats.totalCalls || 0,
            lastUpdate: stats.lastUpdate || null
        };
    }

    /**
     * Actualiza estadísticas de uso
     */
    updateUsageStats(action) {
        const stats = this.getUsageStats() || {
            lastUsed: null,
            totalConnections: 0,
            totalCalls: 0,
            lastUpdate: null
        };

        stats.lastUsed = new Date().toISOString();
        stats.lastUpdate = new Date().toISOString();

        switch (action) {
            case 'connection':
                stats.totalConnections++;
                break;
            case 'call':
                stats.totalCalls++;
                break;
        }

        localStorage.setItem('twilio_usage_stats', JSON.stringify(stats));
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CredentialsManager;
} else {
    window.CredentialsManager = CredentialsManager;
}