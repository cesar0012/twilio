/**
 * Aplicación principal de Twilio Web Phone
 * Coordina todos los módulos y maneja la interfaz de usuario
 */

class TwilioApp {
    constructor() {
        this.isInitialized = false;
        this.dialpadVisible = false;
        
        // Referencias a elementos DOM
        this.elements = {};
        
        // Bind methods
        this.init = this.init.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.handleConnect = this.handleConnect.bind(this);
        this.handleDisconnect = this.handleDisconnect.bind(this);
        this.handleCall = this.handleCall.bind(this);
        }
    });

    /**
     * Inicializa la aplicación
     */
    async init() {
        try {
            console.log('Inicializando Twilio App...');
            
            // Obtener referencias a elementos DOM
            this.cacheElements();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Cargar credenciales guardadas
            this.loadSavedCredentials();
            
            // Configurar dialpad
            this.setupDialpad();
            
            // Verificar si Twilio SDK está disponible
            this.checkTwilioSDK();
            
            this.isInitialized = true;
            console.log('Aplicación inicializada correctamente');
            
        } catch (error) {
            console.error('Error inicializando aplicación:', error);
            this.showError('Error inicializando la aplicación');
        }
    }

    /**
     * Cachea referencias a elementos DOM importantes
     */
    cacheElements() {
        this.elements = {
            // Formulario de credenciales
            credentialsForm: document.getElementById('credentials-form'),
            accountSid: document.getElementById('accountSid'),
            authToken: document.getElementById('authToken'),
            apiKeySid: document.getElementById('apiKeySid'),
            apiKeySecret: document.getElementById('apiKeySecret'),
            twimlAppSid: document.getElementById('twimlAppSid'),
            twilioPhoneNumber: document.getElementById('twilioPhoneNumber'),
            
            // Controles de conexión
            connectButton: document.getElementById('connect-button'),
            disconnectButton: document.getElementById('disconnect-button'),
            clearCredentialsButton: document.getElementById('clear-credentials'),
            
            // Controles de llamada
            phoneNumberInput: document.getElementById('phone-number'),
            callButton: document.getElementById('call-button'),
            hangupButton: document.getElementById('hangup-button'),
            
            // Controles de llamada activa
            muteButton: document.getElementById('mute-button'),
            holdButton: document.getElementById('hold-button'),
            speakerButton: document.getElementById('speaker-button'),
            
            // Dialpad
            dialpadToggle: document.getElementById('dialpad-toggle'),
            dialpadContainer: document.getElementById('dialpad-container'),
            dialpadButtons: document.querySelectorAll('.dialpad-btn'),
            
            // Llamadas entrantes
            acceptButton: document.getElementById('accept-call'),
            rejectButton: document.getElementById('reject-call'),
            
            // Estado y mensajes
            connectionStatus: document.getElementById('connection-status'),
            statusMessages: document.getElementById('status-messages')
        };
    }

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        // Formulario de credenciales
        if (this.elements.credentialsForm) {
            this.elements.credentialsForm.addEventListener('submit', this.handleCredentialsSubmit.bind(this));
        }
        
        // Botones de conexión
        if (this.elements.connectButton) {
            this.elements.connectButton.addEventListener('click', this.handleConnect);
        }
        
        if (this.elements.disconnectButton) {
            this.elements.disconnectButton.addEventListener('click', this.handleDisconnect);
        }
        
        if (this.elements.clearCredentialsButton) {
            this.elements.clearCredentialsButton.addEventListener('click', this.handleClearCredentials.bind(this));
        }
        
        // Controles de llamada
        if (this.elements.callButton) {
            this.elements.callButton.addEventListener('click', this.handleCall);
        }
        
        if (this.elements.hangupButton) {
            this.elements.hangupButton.addEventListener('click', () => {
                window.twilioPhone.hangup();
            });
        }
        
        // Controles de llamada activa
        if (this.elements.muteButton) {
            this.elements.muteButton.addEventListener('click', () => {
                window.twilioPhone.toggleMute();
            });
        }
        
        if (this.elements.holdButton) {
            this.elements.holdButton.addEventListener('click', () => {
                window.twilioPhone.toggleHold();
            });
        }
        
        // Dialpad
        if (this.elements.dialpadToggle) {
            this.elements.dialpadToggle.addEventListener('click', this.toggleDialpad.bind(this));
        }
        
        // Llamadas entrantes
        if (this.elements.acceptButton) {
            this.elements.acceptButton.addEventListener('click', () => {
                window.twilioPhone.acceptCall();
            });
        }
        
        if (this.elements.rejectButton) {
            this.elements.rejectButton.addEventListener('click', () => {
                window.twilioPhone.rejectCall();
            });
        }
        
        // Enter key en input de número
        if (this.elements.phoneNumberInput) {
            this.elements.phoneNumberInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleCall();
                }
            });
        }
    }

    /**
     * Configura el dialpad
     */
    setupDialpad() {
        this.elements.dialpadButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const digit = e.target.dataset.digit;
                if (digit) {
                    this.addDigitToNumber(digit);
                    
                    // Si hay una llamada activa, enviar DTMF
                    if (window.twilioPhone.currentCall) {
                        window.twilioPhone.currentCall.sendDigits(digit);
                    }
                }
            });
        });
    }

    /**
     * Maneja el envío del formulario de credenciales
     */
    handleCredentialsSubmit(e) {
        e.preventDefault();
        
        const credentials = {
            accountSid: this.elements.accountSid.value.trim(),
            authToken: this.elements.authToken.value.trim(),
            apiKeySid: this.elements.apiKeySid.value.trim(),
            apiKeySecret: this.elements.apiKeySecret.value.trim(),
            twimlAppSid: this.elements.twimlAppSid.value.trim(),
            twilioPhoneNumber: this.elements.twilioPhoneNumber.value.trim()
        };
        
        // Validar credenciales
        if (!window.twilioCredentials.validate(credentials)) {
            this.showError('Por favor complete todos los campos requeridos');
            return;
        }
        
        // Guardar credenciales
        window.twilioCredentials.save(credentials);
        this.showSuccess('Credenciales guardadas correctamente');
        
        // Habilitar botón de conexión
        if (this.elements.connectButton) {
            this.elements.connectButton.disabled = false;
        }
    }

    /**
     * Maneja la conexión a Twilio
     */
    async handleConnect() {
        try {
            // Verificar que el SDK de Twilio esté cargado
            if (!this.checkTwilioSDK()) {
                return;
            }
            
            if (!window.twilioCredentials.load()) {
                this.showError('Debe configurar las credenciales primero');
                return;
            }
            
            const success = await window.twilioPhone.connect();
            if (success) {
                this.updateConnectionUI(true);
            }
        } catch (error) {
            console.error('Error conectando:', error);
            this.showError('Error al conectar con Twilio');
        }
    }

    /**
     * Maneja la desconexión de Twilio
     */
    handleDisconnect() {
        window.twilioPhone.disconnect();
        this.updateConnectionUI(false);
    }

    /**
     * Maneja el inicio de una llamada
     */
    handleCall() {
        const phoneNumber = this.elements.phoneNumberInput.value.trim();
        if (!phoneNumber) {
            this.showError('Ingrese un número de teléfono');
            return;
        }
        
        window.twilioPhone.makeCall(phoneNumber);
    }

    /**
     * Maneja la limpieza de credenciales
     */
    handleClearCredentials() {
        Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas eliminar las credenciales guardadas?',
        icon: 'warning',
        iconColor: '#ffab00',
        showCancelButton: true,
        confirmButtonColor: '#ff3e1d',
        cancelButtonColor: '#032cc5',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'swal-custom'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            window.twilioCredentials.clear();
            this.clearCredentialsForm();
            this.updateConnectionUI(false);
            this.showSuccess('Credenciales eliminadas');
        }
    }

    /**
     * Carga las credenciales guardadas en el formulario
     */
    loadSavedCredentials() {
        const credentials = window.twilioCredentials.load();
        if (credentials) {
            if (this.elements.accountSid) this.elements.accountSid.value = credentials.accountSid || '';
            if (this.elements.authToken) this.elements.authToken.value = credentials.authToken || '';
            if (this.elements.apiKeySid) this.elements.apiKeySid.value = credentials.apiKeySid || '';
            if (this.elements.apiKeySecret) this.elements.apiKeySecret.value = credentials.apiKeySecret || '';
            if (this.elements.twimlAppSid) this.elements.twimlAppSid.value = credentials.twimlAppSid || '';
            if (this.elements.twilioPhoneNumber) this.elements.twilioPhoneNumber.value = credentials.twilioPhoneNumber || '';
            
            // Habilitar botón de conexión si las credenciales están completas
            if (window.twilioCredentials.validate(credentials) && this.elements.connectButton) {
                this.elements.connectButton.disabled = false;
            }
        }
    }

    /**
     * Limpia el formulario de credenciales
     */
    clearCredentialsForm() {
        if (this.elements.accountSid) this.elements.accountSid.value = '';
        if (this.elements.authToken) this.elements.authToken.value = '';
        if (this.elements.apiKeySid) this.elements.apiKeySid.value = '';
        if (this.elements.apiKeySecret) this.elements.apiKeySecret.value = '';
        if (this.elements.twimlAppSid) this.elements.twimlAppSid.value = '';
        if (this.elements.twilioPhoneNumber) this.elements.twilioPhoneNumber.value = '';
        
        if (this.elements.connectButton) {
            this.elements.connectButton.disabled = true;
        }
    }

    /**
     * Actualiza la UI según el estado de conexión
     */
    updateConnectionUI(connected) {
        if (this.elements.connectButton) {
            this.elements.connectButton.disabled = connected;
        }
        
        if (this.elements.disconnectButton) {
            this.elements.disconnectButton.disabled = !connected;
        }
        
        // Habilitar/deshabilitar sección de llamadas
        const callSection = document.getElementById('call-section');
        if (callSection) {
            if (connected) {
                callSection.classList.remove('disabled-section');
            } else {
                callSection.classList.add('disabled-section');
            }
        }
    }

    /**
     * Alterna la visibilidad del dialpad
     */
    toggleDialpad() {
        this.dialpadVisible = !this.dialpadVisible;
        
        if (this.elements.dialpadContainer) {
            if (this.dialpadVisible) {
                this.elements.dialpadContainer.classList.remove('d-none');
                this.elements.dialpadContainer.classList.add('fade-in');
            } else {
                this.elements.dialpadContainer.classList.add('d-none');
            }
        }
        
        if (this.elements.dialpadToggle) {
            this.elements.dialpadToggle.innerHTML = this.dialpadVisible 
                ? '<i class="fas fa-th"></i> Ocultar Dialpad'
                : '<i class="fas fa-th"></i> Mostrar Dialpad';
        }
    }

    /**
     * Añade un dígito al número de teléfono
     */
    addDigitToNumber(digit) {
        if (this.elements.phoneNumberInput) {
            this.elements.phoneNumberInput.value += digit;
            this.elements.phoneNumberInput.focus();
        }
    }

    /**
     * Verifica si el SDK de Twilio está disponible
     */
    checkTwilioSDK() {
        if (typeof Twilio === 'undefined') {
            this.showError('SDK de Twilio no está cargado. Verifique la conexión a internet.');
            return false;
        }
        return true;
    }

    /**
     * Muestra un mensaje de éxito
     */
    showSuccess(message) {
        if (this.elements.statusMessages) {
            this.elements.statusMessages.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show" role="alert">
                    <i class="fas fa-check-circle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    }

    /**
     * Muestra un mensaje de error
     */
    showError(message) {
        if (this.elements.statusMessages) {
            this.elements.statusMessages.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    }

    /**
     * Muestra un mensaje informativo
     */
    showInfo(message) {
        if (this.elements.statusMessages) {
            this.elements.statusMessages.innerHTML = `
                <div class="alert alert-info alert-dismissible fade show" role="alert">
                    <i class="fas fa-info-circle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
    }

    /**
     * Limpia todos los mensajes
     */
    clearMessages() {
        if (this.elements.statusMessages) {
            this.elements.statusMessages.innerHTML = '';
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando aplicación...');
    
    // Crear instancia global de la aplicación
    window.twilioApp = new TwilioApp();
    
    // Esperar un momento para que todos los scripts se carguen
    setTimeout(() => {
        window.twilioApp.init();
    }, 100);
});

// Manejar errores globales
window.addEventListener('error', (e) => {
    console.error('Error global:', e.error);
    if (window.twilioApp) {
        window.twilioApp.showError('Ha ocurrido un error inesperado');
    }
});

// Manejar errores de promesas no capturadas
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesa rechazada no manejada:', e.reason);
    if (window.twilioApp) {
        window.twilioApp.showError('Error de conexión o comunicación');
    }
});