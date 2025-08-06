/**
 * Módulo para el manejo de credenciales de Twilio en localStorage
 * Proporciona funciones para guardar, cargar y validar credenciales
 */

class TwilioCredentials {
    constructor() {
        this.storageKey = 'twilio_credentials';
        this.requiredFields = [
            'accountSid',
            'authToken', 
            'apiKeySid',
            'apiKeySecret',
            'twimlAppSid',
            'twilioPhoneNumber'
        ];
    }

    /**
     * Guarda las credenciales en localStorage
     * @param {Object} credentials - Objeto con las credenciales
     * @returns {boolean} - True si se guardaron correctamente
     */
    save(credentials) {
        try {
            // Validar que todas las credenciales requeridas estén presentes
            const isValid = this.validate(credentials);
            if (!isValid.valid) {
                throw new Error(`Credenciales inválidas: ${isValid.errors.join(', ')}`);
            }

            // Encriptar credenciales básicamente (base64)
            const encodedCredentials = btoa(JSON.stringify(credentials));
            localStorage.setItem(this.storageKey, encodedCredentials);
            
            console.log('Credenciales guardadas exitosamente');
            return true;
        } catch (error) {
            console.error('Error guardando credenciales:', error);
            throw error;
        }
    }

    /**
     * Carga las credenciales desde localStorage
     * @returns {Object|null} - Credenciales o null si no existen
     */
    load() {
        try {
            const encodedCredentials = localStorage.getItem(this.storageKey);
            if (!encodedCredentials) {
                return null;
            }

            // Decodificar credenciales
            const credentials = JSON.parse(atob(encodedCredentials));
            
            // Validar credenciales cargadas
            const isValid = this.validate(credentials);
            if (!isValid.valid) {
                console.warn('Credenciales cargadas son inválidas, limpiando...');
                this.clear();
                return null;
            }

            return credentials;
        } catch (error) {
            console.error('Error cargando credenciales:', error);
            this.clear(); // Limpiar credenciales corruptas
            return null;
        }
    }

    /**
     * Elimina las credenciales de localStorage
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('Credenciales eliminadas');
        } catch (error) {
            console.error('Error eliminando credenciales:', error);
        }
    }

    /**
     * Verifica si existen credenciales guardadas
     * @returns {boolean}
     */
    exists() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    /**
     * Valida un objeto de credenciales
     * @param {Object} credentials - Credenciales a validar
     * @returns {Object} - {valid: boolean, errors: string[]}
     */
    validate(credentials) {
        const errors = [];

        if (!credentials || typeof credentials !== 'object') {
            return { valid: false, errors: ['Credenciales deben ser un objeto'] };
        }

        // Verificar campos requeridos
        this.requiredFields.forEach(field => {
            if (!credentials[field] || credentials[field].trim() === '') {
                errors.push(`Campo requerido: ${field}`);
            }
        });

        // Validaciones específicas
        if (credentials.accountSid && !credentials.accountSid.startsWith('AC')) {
            errors.push('Account SID debe comenzar con "AC"');
        }

        if (credentials.apiKeySid && !credentials.apiKeySid.startsWith('SK')) {
            errors.push('API Key SID debe comenzar con "SK"');
        }

        if (credentials.twimlAppSid && !credentials.twimlAppSid.startsWith('AP')) {
            errors.push('TwiML App SID debe comenzar con "AP"');
        }

        if (credentials.twilioPhoneNumber && !credentials.twilioPhoneNumber.startsWith('+')) {
            errors.push('Número de teléfono debe incluir código de país (+)');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Obtiene credenciales para enviar al backend (sin Auth Token)
     * @returns {Object|null} - Credenciales para el backend
     */
    getForBackend() {
        const credentials = this.load();
        if (!credentials) {
            return null;
        }

        // Retornar solo las credenciales necesarias para el backend
        return {
            accountSid: credentials.accountSid,
            apiKeySid: credentials.apiKeySid,
            apiKeySecret: credentials.apiKeySecret,
            twimlAppSid: credentials.twimlAppSid,
            twilioPhoneNumber: credentials.twilioPhoneNumber
        };
    }

    /**
     * Actualiza credenciales específicas sin reemplazar todas
     * @param {Object} updates - Campos a actualizar
     * @returns {boolean} - True si se actualizaron correctamente
     */
    update(updates) {
        try {
            const currentCredentials = this.load() || {};
            const updatedCredentials = { ...currentCredentials, ...updates };
            return this.save(updatedCredentials);
        } catch (error) {
            console.error('Error actualizando credenciales:', error);
            throw error;
        }
    }

    /**
     * Exporta credenciales para respaldo (sin datos sensibles)
     * @returns {Object} - Credenciales para exportar
     */
    export() {
        const credentials = this.load();
        if (!credentials) {
            return null;
        }

        return {
            accountSid: credentials.accountSid,
            apiKeySid: credentials.apiKeySid,
            twimlAppSid: credentials.twimlAppSid,
            twilioPhoneNumber: credentials.twilioPhoneNumber,
            // No incluir tokens/secrets por seguridad
            exportDate: new Date().toISOString()
        };
    }
}

// Crear instancia global
window.twilioCredentials = new TwilioCredentials();