/**
 * Módulo para el manejo de llamadas con Twilio.Device
 * Gestiona la conexión, llamadas entrantes y salientes
 */

class TwilioPhone {
    constructor() {
        this.device = null;
        this.currentCall = null;
        this.isConnected = false;
        this.isMuted = false;
        this.isOnHold = false;
        this.callTimer = null;
        this.callStartTime = null;
        this.backendUrl = 'http://oskc0c4k8c8800sko0go44oc.161.97.64.43.sslip.io'; // URL del backend Flask en VPS
        
        // Bind methods
        this.setupDevice = this.setupDevice.bind(this);
        this.makeCall = this.makeCall.bind(this);
        this.hangup = this.hangup.bind(this);
        this.acceptCall = this.acceptCall.bind(this);
        this.rejectCall = this.rejectCall.bind(this);
    }

    /**
     * Inicializa la conexión con Twilio usando las credenciales
     * @returns {Promise<boolean>} - True si la conexión fue exitosa
     */
    async connect() {
        try {
            this.updateStatus('Conectando...', 'connecting');
            
            // Obtener credenciales
            const credentials = window.twilioCredentials.getForBackend();
            if (!credentials) {
                throw new Error('No hay credenciales disponibles');
            }

            // Solicitar token al backend
            const token = await this.getAccessToken(credentials);
            if (!token) {
                throw new Error('No se pudo obtener el token de acceso');
            }

            // Configurar Twilio.Device
            await this.setupDevice(token);
            
            this.isConnected = true;
            this.updateStatus('Conectado', 'connected');
            this.enableCallControls(true);
            
            return true;
        } catch (error) {
            console.error('Error conectando:', error);
            this.updateStatus(`Error: ${error.message}`, 'disconnected');
            this.enableCallControls(false);
            return false;
        }
    }

    /**
     * Obtiene un token de acceso del backend
     * @param {Object} credentials - Credenciales de Twilio
     * @returns {Promise<string>} - Token de acceso
     */
    async getAccessToken(credentials) {
        try {
            const response = await fetch(`${this.backendUrl}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error del servidor');
            }

            const data = await response.json();
            return data.token;
        } catch (error) {
            console.error('Error obteniendo token:', error);
            throw error;
        }
    }

    /**
     * Configura Twilio.Device con el token
     * @param {string} token - Token de acceso
     */
    async setupDevice(token) {
        return new Promise((resolve, reject) => {
            try {
                // Configurar Twilio Device con el nuevo SDK (2.0+)
                // El token se pasa directamente al constructor
                this.device = new Twilio.Device(token, {
                    debug: true,
                    answerOnBridge: true
                });
                
                // Event listeners
                this.device.on('registered', () => {
                    console.log('Twilio.Device está registrado y listo');
                    resolve();
                });

                this.device.on('error', (error) => {
                    console.error('Error en Twilio.Device:', error);
                    reject(error);
                });

                this.device.on('connect', (call) => {
                    console.log('Llamada conectada');
                    this.currentCall = call;
                    this.onCallConnected(call);
                });

                this.device.on('disconnect', (call) => {
                    console.log('Llamada desconectada');
                    this.onCallDisconnected(call);
                });

                this.device.on('incoming', (call) => {
                    console.log('Llamada entrante');
                    this.onIncomingCall(call);
                });

                this.device.on('cancel', () => {
                    console.log('Llamada cancelada');
                    this.onCallDisconnected();
                });

                // Registrar el device para recibir llamadas entrantes
                this.device.register();

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Realiza una llamada saliente
     * @param {string} phoneNumber - Número a llamar
     */
    async makeCall(phoneNumber) {
        try {
            if (!this.device || !this.isConnected) {
                throw new Error('Device no está conectado');
            }

            if (this.currentCall) {
                throw new Error('Ya hay una llamada en curso');
            }

            // Validar número
            if (!phoneNumber || phoneNumber.trim() === '') {
                throw new Error('Debe ingresar un número de teléfono');
            }

            // Limpiar y formatear número
            const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
            if (!cleanNumber.startsWith('+')) {
                throw new Error('El número debe incluir código de país (+)');
            }

            this.updateStatus('Realizando llamada...', 'connecting');
            
            // Realizar llamada
            const call = await this.device.connect({
                To: cleanNumber
            });

            this.currentCall = call;
            
            // Configurar event listeners para esta llamada específica
            call.on('accept', () => {
                console.log('Llamada aceptada');
                this.onCallConnected(call);
            });
            
            call.on('disconnect', () => {
                console.log('Llamada desconectada');
                this.onCallDisconnected(call);
            });
            
            call.on('cancel', () => {
                console.log('Llamada cancelada');
                this.onCallDisconnected(call);
            });
            
            call.on('error', (error) => {
                console.error('Error en la llamada:', error);
                this.showError(`Error en la llamada: ${error.message}`);
                this.updateStatus('Conectado', 'connected');
            });
            
        } catch (error) {
            console.error('Error realizando llamada:', error);
            this.showError(`Error: ${error.message}`);
            this.updateStatus('Conectado', 'connected');
        }
    }

    /**
     * Acepta una llamada entrante
     */
    acceptCall() {
        if (this.currentCall) {
            this.currentCall.accept();
            this.hideIncomingCall();
        }
    }

    /**
     * Rechaza una llamada entrante
     */
    rejectCall() {
        if (this.currentCall) {
            this.currentCall.reject();
            this.currentCall = null;
            this.hideIncomingCall();
        }
    }

    /**
     * Cuelga la llamada actual
     */
    hangup() {
        if (this.currentCall) {
            this.currentCall.disconnect();
        }
    }

    /**
     * Silencia/desilencia el micrófono
     */
    toggleMute() {
        if (this.currentCall) {
            this.isMuted = !this.isMuted;
            this.currentCall.mute(this.isMuted);
            this.updateMuteButton();
        }
    }

    /**
     * Pone en espera/reanuda la llamada
     */
    toggleHold() {
        // Nota: Hold no está directamente soportado en Twilio Client JS
        // Se puede implementar usando mute como alternativa
        this.toggleMute();
        this.isOnHold = this.isMuted;
        this.updateHoldButton();
    }

    /**
     * Desconecta el device
     */
    disconnect() {
        try {
            if (this.currentCall) {
                this.hangup();
            }
            
            if (this.device) {
                this.device.destroy();
                this.device = null;
            }
            
            this.isConnected = false;
            this.updateStatus('Desconectado', 'disconnected');
            this.enableCallControls(false);
            
        } catch (error) {
            console.error('Error desconectando:', error);
        }
    }

    /**
     * Maneja el evento de llamada conectada
     */
    onCallConnected(call) {
        this.showCallInfo(call);
        this.startCallTimer();
        this.enableCallControls(true, true); // Habilitar controles de llamada activa
        this.updateStatus('En llamada', 'connected');
    }

    /**
     * Maneja el evento de llamada desconectada
     */
    onCallDisconnected(call) {
        this.hideCallInfo();
        this.hideIncomingCall();
        this.stopCallTimer();
        this.currentCall = null;
        this.isMuted = false;
        this.isOnHold = false;
        this.enableCallControls(true, false); // Deshabilitar controles de llamada activa
        this.updateStatus('Conectado', 'connected');
    }

    /**
     * Maneja llamadas entrantes
     */
    onIncomingCall(call) {
        this.currentCall = call;
        this.showIncomingCall(call);
    }

    /**
     * Actualiza el estado de conexión en la UI
     */
    updateStatus(message, status) {
        const statusElement = document.getElementById('connection-status');
        const messagesElement = document.getElementById('status-messages');
        
        if (statusElement) {
            let icon = 'fas fa-circle';
            let className = 'text-danger';
            
            switch (status) {
                case 'connected':
                    icon = 'fas fa-circle';
                    className = 'text-success';
                    break;
                case 'connecting':
                    icon = 'fas fa-spinner fa-spin';
                    className = 'text-warning';
                    break;
                case 'disconnected':
                default:
                    icon = 'fas fa-circle';
                    className = 'text-danger';
                    break;
            }
            
            statusElement.innerHTML = `<i class="${icon} ${className}"></i> ${message}`;
        }
        
        if (messagesElement) {
            messagesElement.innerHTML = `<p class="mb-0">${message}</p>`;
        }
    }

    /**
     * Habilita/deshabilita controles de llamada
     */
    enableCallControls(enabled, inCall = false) {
        const callButton = document.getElementById('call-button');
        const hangupButton = document.getElementById('hangup-button');
        const muteButton = document.getElementById('mute-button');
        const holdButton = document.getElementById('hold-button');
        const speakerButton = document.getElementById('speaker-button');
        
        if (callButton) callButton.disabled = !enabled || inCall;
        if (hangupButton) hangupButton.disabled = !inCall;
        if (muteButton) muteButton.disabled = !inCall;
        if (holdButton) holdButton.disabled = !inCall;
        if (speakerButton) speakerButton.disabled = !inCall;
    }

    /**
     * Muestra información de llamada activa
     */
    showCallInfo(call) {
        const callInfo = document.getElementById('call-info');
        const callNumber = document.getElementById('call-number');
        
        if (callInfo && callNumber) {
            const remoteNumber = call.parameters.To || call.parameters.From || 'Desconocido';
            callNumber.textContent = remoteNumber;
            callInfo.classList.remove('d-none');
            callInfo.classList.add('fade-in');
        }
    }

    /**
     * Oculta información de llamada
     */
    hideCallInfo() {
        const callInfo = document.getElementById('call-info');
        if (callInfo) {
            callInfo.classList.add('d-none');
        }
    }

    /**
     * Muestra interfaz de llamada entrante
     */
    showIncomingCall(call) {
        const incomingCall = document.getElementById('incoming-call');
        const incomingNumber = document.getElementById('incoming-number');
        
        if (incomingCall && incomingNumber) {
            const fromNumber = call.parameters.From || 'Desconocido';
            incomingNumber.textContent = fromNumber;
            incomingCall.classList.remove('d-none');
            incomingCall.classList.add('fade-in', 'pulse');
        }
    }

    /**
     * Oculta interfaz de llamada entrante
     */
    hideIncomingCall() {
        const incomingCall = document.getElementById('incoming-call');
        if (incomingCall) {
            incomingCall.classList.add('d-none');
            incomingCall.classList.remove('pulse');
        }
    }

    /**
     * Inicia el timer de llamada
     */
    startCallTimer() {
        this.callStartTime = new Date();
        this.callTimer = setInterval(() => {
            this.updateCallTimer();
        }, 1000);
    }

    /**
     * Detiene el timer de llamada
     */
    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        this.callStartTime = null;
    }

    /**
     * Actualiza el display del timer
     */
    updateCallTimer() {
        if (!this.callStartTime) return;
        
        const now = new Date();
        const elapsed = Math.floor((now - this.callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Actualiza el botón de silenciar
     */
    updateMuteButton() {
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            if (this.isMuted) {
                muteButton.innerHTML = '<i class="fas fa-microphone-slash"></i> Activar';
                muteButton.classList.add('control-muted');
            } else {
                muteButton.innerHTML = '<i class="fas fa-microphone"></i> Silenciar';
                muteButton.classList.remove('control-muted');
            }
        }
    }

    /**
     * Actualiza el botón de retener
     */
    updateHoldButton() {
        const holdButton = document.getElementById('hold-button');
        if (holdButton) {
            if (this.isOnHold) {
                holdButton.innerHTML = '<i class="fas fa-play"></i> Reanudar';
                holdButton.classList.add('control-active');
            } else {
                holdButton.innerHTML = '<i class="fas fa-pause"></i> Retener';
                holdButton.classList.remove('control-active');
            }
        }
    }

    /**
     * Muestra un mensaje de error
     */
    showError(message) {
        const messagesElement = document.getElementById('status-messages');
        if (messagesElement) {
            messagesElement.innerHTML = `<p class="text-danger mb-0"><i class="fas fa-exclamation-triangle"></i> ${message}</p>`;
        }
    }
}

// Crear instancia global
window.twilioPhone = new TwilioPhone();