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
            identity: document.getElementById('identity'),
            twilioPhoneNumber: document.getElementById('twilioPhoneNumber'),
            
            // Controles de conexión
            connectButton: document.getElementById('connect-button'),
            disconnectButton: document.getElementById('disconnect-button'),
            clearCredentialsButton: document.getElementById('clear-credentials'),
            
            // Controles de llamada
            phoneNumberInput: document.getElementById('phoneNumber'),
            callButton: document.getElementById('callButton'),
            hangupButton: document.getElementById('hangup-button'),
            
            // Controles de llamada activa
            muteButton: document.getElementById('mute-button'),
            holdButton: document.getElementById('hold-button'),
            speakerButton: document.getElementById('speaker-button'),
            
            // Dialpad
            dialpadButtons: document.querySelectorAll('.dialpad-btn'),
            clearNumberButton: document.getElementById('clearNumberButton'),
            
            // Llamadas entrantes
            acceptButton: document.getElementById('accept-call'),
            rejectButton: document.getElementById('reject-call'),
            incomingCallModal: document.getElementById('incomingCallModal'),
            incomingCallNumber: document.getElementById('incoming-call-number'),
            
            // Estado y mensajes
            connectionStatus: document.getElementById('connection-status'),
            statusMessage: document.getElementById('status-message'),
            callOverlay: document.getElementById('call-overlay'),
            callStatus: document.getElementById('call-status'),
            callTimer: document.getElementById('call-timer'),
            
            // Elementos adicionales del Template
            autoConnect: document.getElementById('connectionToggle'),
            microphoneSelect: document.getElementById('microphone-select'),
            speakerSelect: document.getElementById('speaker-select'),
            volumeControl: document.getElementById('volume-control')
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
        
        // Toggle de conexión automática
        if (this.elements.autoConnect) {
            this.elements.autoConnect.addEventListener('change', this.handleAutoConnectToggle.bind(this));
        }
        
        // Botón de guardar credenciales
        const saveCredentialsBtn = document.getElementById('saveCredentialsBtn');
        if (saveCredentialsBtn) {
            saveCredentialsBtn.addEventListener('click', this.handleCredentialsSubmit.bind(this));
        }
        
        // Controles de llamada
        if (this.elements.callButton) {
            this.elements.callButton.addEventListener('click', this.handleCall);
        }
        
        // Botón de colgar manejado por setupCallControlEventListeners en phone.js
        
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
            
            // Validar entrada del input - solo números y símbolos # *
            this.elements.phoneNumberInput.addEventListener('input', (e) => {
                const value = e.target.value;
                const validChars = /^[0-9#*+\-\s()]*$/;
                
                if (!validChars.test(value)) {
                    e.target.value = value.replace(/[^0-9#*+\-\s()]/g, '');
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
                const digit = e.currentTarget.dataset.digit;
                if (digit) {
                    this.addDigitToNumber(digit);
                    
                    // Si hay una llamada activa, enviar DTMF
                    if (window.twilioPhone.currentCall) {
                        window.twilioPhone.currentCall.sendDigits(digit);
                    }
                }
            });
        });
        
        // Botón de borrar
        if (this.elements.clearNumberButton) {
            // Remover event listeners existentes para evitar duplicados
            this.elements.clearNumberButton.replaceWith(this.elements.clearNumberButton.cloneNode(true));
            // Volver a obtener la referencia después del reemplazo
            this.elements.clearNumberButton = document.getElementById('clearNumberButton');
            
            this.elements.clearNumberButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.elements.phoneNumberInput) {
                    this.elements.phoneNumberInput.value = '';
                    this.elements.phoneNumberInput.focus();
                }
            });
        }
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
        let phoneNumber = this.elements.phoneNumberInput.value.trim();
        if (!phoneNumber) {
            this.showError('Ingrese un número de teléfono');
            return;
        }
        
        // Agregar '+' automáticamente si no está presente
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
        }
        
        window.twilioPhone.makeCall(phoneNumber);
    }

    /**
     * Maneja la limpieza de credenciales
     */
    handleClearCredentials() {
        if (confirm('¿Está seguro de que desea eliminar las credenciales guardadas?')) {
            window.twilioCredentials.clear();
            this.clearCredentialsForm();
            this.updateConnectionUI(false);
            this.showSuccess('Credenciales eliminadas');
        }
    }

    /**
     * Maneja el toggle de conexión automática
     */
    async handleAutoConnectToggle() {
        if (this.elements.autoConnect.checked) {
            // Si se activa el toggle, intentar conectar automáticamente
            if (window.twilioCredentials.load()) {
                await this.handleConnect();
            } else {
                this.showError('Debe configurar las credenciales primero');
                this.elements.autoConnect.checked = false;
            }
        } else {
            // Si se desactiva el toggle, desconectar
            this.handleDisconnect();
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
        this.showNotification(message, 'success');
    }

    /**
     * Muestra un mensaje de error
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Muestra un mensaje informativo
     */
    showInfo(message) {
        this.showNotification(message, 'info');
    }

    /**
     * Muestra notificaciones usando SweetAlert2
     */
    showNotification(message, type = 'info') {
        const swalConfig = {
            text: message,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            customClass: {
                popup: 'colored-toast'
            }
        };
        
        switch(type) {
            case 'success':
                swalConfig.icon = 'success';
                swalConfig.iconColor = '#7ac943';
                break;
            case 'error':
            case 'danger':
                swalConfig.icon = 'error';
                swalConfig.iconColor = '#ff3e1d';
                break;
            case 'warning':
                swalConfig.icon = 'warning';
                swalConfig.iconColor = '#ffab00';
                break;
            case 'info':
            default:
                swalConfig.icon = 'info';
                swalConfig.iconColor = '#032cc5';
                break;
        }
        
        Swal.fire(swalConfig);
    }

    /**
     * Limpia todos los mensajes de estado
     */
    clearMessages() {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.innerHTML = '';
        }
    }

    /**
     * Actualiza el estado de conexión en la UI
     */
    updateConnectionStatus(status, message) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = message;
        }
        
        // Actualizar avatar status
        const avatar = document.querySelector('.avatar');
        if (avatar) {
            avatar.className = status === 'connected' ? 
                'avatar avatar-online' : 
                'avatar avatar-offline';
        }
    }

    /**
     * Muestra información de llamada activa
     */
    showCallInfo(number, duration = '00:00') {
        if (this.elements.callOverlay) {
            this.elements.callOverlay.classList.remove('d-none');
        }
        
        if (this.elements.callNumber) {
            this.elements.callNumber.textContent = number;
        }
        
        if (this.elements.callTimer) {
            this.elements.callTimer.textContent = duration;
        }
        
        if (this.elements.callStatus) {
            this.elements.callStatus.textContent = 'Conectado';
        }
    }

    /**
     * Oculta información de llamada
     */
    hideCallInfo() {
        if (this.elements.callOverlay) {
            this.elements.callOverlay.classList.add('d-none');
        }
    }

    /**
     * Muestra llamada entrante
     */
    showIncomingCall(number) {
        if (this.elements.incomingCallNumber) {
            this.elements.incomingCallNumber.textContent = number;
        }
        
        // Mostrar modal de llamada entrante
        if (this.elements.incomingCallModal) {
            const modal = new bootstrap.Modal(this.elements.incomingCallModal);
            modal.show();
        }
    }

    /**
      * Oculta llamada entrante
      */
     hideIncomingCall() {
         if (this.elements.incomingCallModal) {
             const modal = bootstrap.Modal.getInstance(this.elements.incomingCallModal);
             if (modal) {
                 modal.hide();
             }
         }
     }

     /**
      * Actualiza el estado de los botones de llamada
      */
     updateCallButtons(inCall) {
         if (this.elements.callButton) {
             this.elements.callButton.disabled = inCall;
         }
         
         if (this.elements.hangupButton) {
             this.elements.hangupButton.disabled = !inCall;
         }
     }



     /**
      * Inicializa el dialpad
      */
     initializeDialpad() {
         // Esta función se mantiene para compatibilidad pero la funcionalidad
         // del dialpad se maneja en setupDialpad() y setupEventListeners()
         console.log('Dialpad inicializado');
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
        
        console.log('Twilio App inicializada con Template UI');
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