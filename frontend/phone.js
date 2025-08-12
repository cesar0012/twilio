/**
 * PhoneManager - Gestión de llamadas VoIP con Twilio
 * Maneja la conexión con Twilio Voice SDK y todas las operaciones de llamadas
 */

class PhoneManager {
    constructor(app) {
        this.app = app;
        this.device = null;
        this.currentCall = null;
        this.isConnected = false;
        this.isRegistered = false;
        this.backendUrl = 'https://twilio.neox.site'; // URL del backend
        
        // Audio settings
        this.audioSettings = {
            inputVolume: 1.0,
            outputVolume: 1.0,
            echoCancellation: true,
            noiseSuppression: true
        };
        
        // Call state
        this.callState = {
            isMuted: false,
            isOnHold: false,
            isSpeakerOn: false,
            callStartTime: null,
            callDuration: 0
        };
        
        this.initializeAudio();
    }

    /**
     * Inicializa la configuración de audio
     */
    async initializeAudio() {
        try {
            // Solicitar permisos de micrófono
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('Audio permissions granted');
        } catch (error) {
            console.error('Error getting audio permissions:', error);
            this.app.showNotification('Se requieren permisos de micrófono para realizar llamadas', 'warning');
        }
    }

    /**
     * Conecta con Twilio usando las credenciales guardadas
     */
    async connect() {
        try {
            const credentials = this.app.credentialsManager.getCredentials();
            if (!credentials) {
                throw new Error('No hay credenciales guardadas');
            }

            this.app.updateConnectionStatus('connecting');
            
            // Obtener token de acceso desde el backend
            const accessToken = await this.getAccessToken(credentials);
            if (!accessToken) {
                throw new Error('No se pudo obtener el token de acceso');
            }

            // Configurar el dispositivo Twilio
            this.device = new Twilio.Device(accessToken, {
                logLevel: 1,
                answerOnBridge: true,
                fakeLocalDTMF: true,
                enableRingingState: true
            });

            // Configurar event listeners
            this.setupDeviceEventListeners();

            // Registrar el dispositivo
            await this.device.register();
            
            this.isConnected = true;
            this.isRegistered = true;
            this.app.updateConnectionStatus('connected');
            this.app.showNotification('Conectado exitosamente a Twilio', 'success');
            
            // Actualizar estadísticas
            this.app.credentialsManager.updateUsageStats('connection');
            
            console.log('Successfully connected to Twilio');
            return true;
            
        } catch (error) {
            console.error('Error connecting to Twilio:', error);
            this.app.updateConnectionStatus('disconnected');
            const errorMessage = error?.message || error?.toString() || 'Error desconocido';
            this.app.showNotification(`Error de conexión: ${errorMessage}`, 'error');
            return false;
        }
    }

    /**
     * Desconecta de Twilio
     */
    async disconnect() {
        try {
            if (this.currentCall) {
                this.currentCall.disconnect();
            }

            if (this.device) {
                this.device.unregister();
                this.device.destroy();
                this.device = null;
            }

            this.isConnected = false;
            this.isRegistered = false;
            this.currentCall = null;
            
            this.app.updateConnectionStatus('disconnected');
            this.app.showNotification('Desconectado de Twilio', 'info');
            
            console.log('Disconnected from Twilio');
            return true;
            
        } catch (error) {
            console.error('Error disconnecting from Twilio:', error);
            this.app.showNotification(`Error al desconectar: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Configura los event listeners del dispositivo Twilio
     */
    setupDeviceEventListeners() {
        if (!this.device) return;

        // Dispositivo listo
        this.device.on('ready', () => {
            console.log('Twilio Device is ready');
        });

        // Error del dispositivo
        this.device.on('error', (error) => {
            console.error('Twilio Device error:', error);
            this.app.showNotification(`Error del dispositivo: ${error.message}`, 'error');
        });

        // Llamada entrante
        this.device.on('incoming', (call) => {
            console.log('Incoming call from:', call.parameters.From);
            this.handleIncomingCall(call);
        });

        // Dispositivo desconectado
        this.device.on('offline', () => {
            console.log('Twilio Device went offline');
            this.isConnected = false;
            this.app.updateConnectionStatus('disconnected');
            this.app.showNotification('Dispositivo desconectado', 'warning');
        });

        // Token expirado
        this.device.on('tokenWillExpire', () => {
            console.log('Token will expire, refreshing...');
            this.refreshToken();
        });
    }

    /**
     * Maneja llamadas entrantes
     */
    handleIncomingCall(call) {
        this.currentCall = call;
        const callerNumber = call.parameters.From || 'Número desconocido';
        
        // Mostrar modal de llamada entrante
        this.app.showIncomingCallModal(callerNumber);
        
        // Configurar event listeners para la llamada
        this.setupCallEventListeners(call);
        
        // Agregar a historial
        this.app.historyManager.addCall({
            number: callerNumber,
            type: 'incoming',
            status: 'ringing',
            timestamp: new Date()
        });
        
        // Reproducir tono de llamada
        this.playRingtone();
    }

    /**
     * Realiza una llamada saliente
     */
    async makeCall(phoneNumber) {
        try {
            if (!this.device || !this.isConnected) {
                throw new Error('Dispositivo no conectado');
            }

            if (!phoneNumber || phoneNumber.trim() === '') {
                throw new Error('Número de teléfono requerido');
            }

            // Formatear número
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            
            this.app.updateConnectionStatus('calling');
            
            const params = {
                To: formattedNumber,
                twilio_phone_number: this.app.credentialsManager.getCredentials().twilioPhoneNumber
            };

            // Realizar la llamada
            this.currentCall = await this.device.connect(params);
            
            // Configurar event listeners
            this.setupCallEventListeners(this.currentCall);
            
            // Mostrar overlay de llamada
            this.app.showCallOverlay(formattedNumber, 'Conectando...');
            
            // Agregar a historial
            this.app.historyManager.addCall({
                number: formattedNumber,
                type: 'outgoing',
                status: 'connecting',
                timestamp: new Date()
            });
            
            // Actualizar estadísticas
            this.app.credentialsManager.updateUsageStats('call');
            
            console.log('Call initiated to:', formattedNumber);
            return true;
            
        } catch (error) {
            console.error('Error making call:', error);
            this.app.showNotification(`Error al realizar llamada: ${error.message}`, 'error');
            this.app.updateConnectionStatus('connected');
            return false;
        }
    }

    /**
     * Configura los event listeners para una llamada
     */
    setupCallEventListeners(call) {
        if (!call) return;

        // Llamada aceptada/conectada
        call.on('accept', () => {
            console.log('Call accepted');
            this.callState.callStartTime = new Date();
            this.app.updateConnectionStatus('connected');
            
            if (this.app.elements.callStatus) {
                this.app.elements.callStatus.textContent = 'Conectado';
            }
            
            this.stopRingtone();
        });

        // Llamada desconectada
        call.on('disconnect', () => {
            console.log('Call disconnected');
            this.handleCallEnd();
        });

        // Error en la llamada
        call.on('error', (error) => {
            console.error('Call error:', error);
            this.app.showNotification(`Error en la llamada: ${error.message}`, 'error');
            this.handleCallEnd();
        });

        // Llamada rechazada
        call.on('reject', () => {
            console.log('Call rejected');
            this.handleCallEnd();
        });

        // Llamada cancelada
        call.on('cancel', () => {
            console.log('Call cancelled');
            this.handleCallEnd();
        });

        // Estado de la llamada cambiado
        call.on('ringing', () => {
            console.log('Call is ringing');
            if (this.app.elements.callStatus) {
                this.app.elements.callStatus.textContent = 'Timbrando...';
            }
        });
    }

    /**
     * Maneja el final de una llamada
     */
    handleCallEnd() {
        // Calcular duración
        if (this.callState.callStartTime) {
            this.callState.callDuration = new Date() - this.callState.callStartTime;
        }
        
        // Limpiar estado
        this.currentCall = null;
        this.callState = {
            isMuted: false,
            isOnHold: false,
            isSpeakerOn: false,
            callStartTime: null,
            callDuration: 0
        };
        
        // Actualizar UI
        this.app.hideCallOverlay();
        this.app.hideIncomingCallModal();
        this.app.updateConnectionStatus('connected');
        
        // Detener tonos
        this.stopRingtone();
        
        // Actualizar historial
        this.app.renderHistory();
        
        console.log('Call ended');
    }

    /**
     * Acepta una llamada entrante
     */
    acceptCall() {
        if (this.currentCall) {
            this.currentCall.accept();
            this.app.hideIncomingCallModal();
            
            // Mostrar overlay de llamada
            const callerNumber = this.currentCall.parameters.From || 'Número desconocido';
            this.app.showCallOverlay(callerNumber, 'Conectando...');
        }
    }

    /**
     * Rechaza una llamada entrante
     */
    rejectCall() {
        if (this.currentCall) {
            this.currentCall.reject();
            this.app.hideIncomingCallModal();
        }
    }

    /**
     * Cuelga la llamada actual
     */
    hangupCall() {
        if (this.currentCall) {
            this.currentCall.disconnect();
        }
    }

    /**
     * Alterna el estado de mute
     */
    toggleMute() {
        if (!this.currentCall) return;
        
        const isMuted = this.currentCall.isMuted();
        this.currentCall.mute(!isMuted);
        this.callState.isMuted = !isMuted;
        
        // Actualizar UI
        if (this.app.elements.muteBtn) {
            this.app.elements.muteBtn.classList.toggle('active', !isMuted);
            this.app.elements.muteBtn.innerHTML = !isMuted ? 
                '<i class="fas fa-microphone-slash"></i>' : 
                '<i class="fas fa-microphone"></i>';
        }
        
        this.app.showNotification(
            !isMuted ? 'Micrófono silenciado' : 'Micrófono activado', 
            'info'
        );
    }

    /**
     * Envía tonos DTMF
     */
    sendDTMF(digit) {
        if (this.currentCall && this.currentCall.status() === 'open') {
            this.currentCall.sendDigits(digit);
            console.log('Sent DTMF:', digit);
        }
    }

    /**
     * Obtiene token de acceso del backend
     */
    async getAccessToken(credentials) {
        try {
            console.log('DEBUG: Enviando solicitud de token al backend');
            console.log('DEBUG: URL de solicitud:', `${this.backendUrl}/token`);
            console.log('DEBUG: Credenciales a enviar:', {
                accountSid: credentials.accountSid ? 'presente' : 'ausente',
                apiKeySid: credentials.apiKeySid ? 'presente' : 'ausente',
                apiKeySecret: credentials.apiKeySecret ? 'presente' : 'ausente',
                twimlAppSid: credentials.twimlAppSid ? 'presente' : 'ausente',
                twilioPhoneNumber: credentials.twilioPhoneNumber ? 'presente' : 'ausente'
            });
            
            const response = await fetch(`${this.backendUrl}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            console.log('DEBUG: Respuesta del servidor recibida');
            console.log('DEBUG: Status de respuesta:', response.status);

            if (!response.ok) {
                console.error('DEBUG: Error en respuesta del servidor');
                const errorText = await response.text();
                console.error('DEBUG: Texto de error:', errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
                }
                
                throw new Error(errorData.error || 'Error del servidor');
            }

            const data = await response.json();
            console.log('DEBUG: Token recibido:', data.token ? 'presente' : 'ausente');
            
            return data.token;
            
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error; // Re-lanzar el error en lugar de usar fallback
        }
    }

    /**
     * Refresca el token de acceso
     */
    async refreshToken() {
        try {
            const credentials = this.app.credentialsManager.getCredentials();
            if (!credentials) {
                throw new Error('No credentials available');
            }

            const newToken = await this.getAccessToken(credentials);
            if (newToken && this.device) {
                this.device.updateToken(newToken);
                console.log('Token refreshed successfully');
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            this.app.showNotification('Error al renovar token de acceso', 'error');
        }
    }

    /**
     * Formatea un número de teléfono
     */
    formatPhoneNumber(phoneNumber) {
        // Remover caracteres no numéricos excepto +
        let formatted = phoneNumber.replace(/[^\d+]/g, '');
        
        // Si no empieza con +, agregar +1 para números de US
        if (!formatted.startsWith('+')) {
            formatted = '+1' + formatted;
        }
        
        return formatted;
    }

    /**
     * Reproduce tono de llamada
     */
    playRingtone() {
        // Implementar reproducción de tono
        console.log('Playing ringtone...');
    }

    /**
     * Detiene el tono de llamada
     */
    stopRingtone() {
        // Implementar detención de tono
        console.log('Stopping ringtone...');
    }

    /**
     * Obtiene información del dispositivo
     */
    getDeviceInfo() {
        if (!this.device) {
            return null;
        }

        return {
            isConnected: this.isConnected,
            isRegistered: this.isRegistered,
            state: this.device.state,
            version: Twilio.Device.version || 'Unknown'
        };
    }

    /**
     * Obtiene estadísticas de la llamada actual
     */
    getCallStats() {
        if (!this.currentCall) {
            return null;
        }

        return {
            status: this.currentCall.status(),
            direction: this.currentCall.direction,
            isMuted: this.callState.isMuted,
            isOnHold: this.callState.isOnHold,
            duration: this.callState.callDuration,
            startTime: this.callState.callStartTime
        };
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhoneManager;
} else {
    window.PhoneManager = PhoneManager;
}