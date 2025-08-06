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
        this.backendUrl = 'https://oskc0c4k8c8800sko0go44oc.161.97.64.43.sslip.io'; // URL del backend Flask en VPS
        
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
            console.log('DEBUG: Iniciando proceso de conexión');
            this.updateStatus('Conectando...', 'connecting');
            
            // Obtener credenciales
            console.log('DEBUG: Obteniendo credenciales...');
            const credentials = window.twilioCredentials.getForBackend();
            if (!credentials) {
                console.error('DEBUG: No hay credenciales disponibles');
                throw new Error('No hay credenciales disponibles');
            }
            
            console.log('DEBUG: Credenciales obtenidas:', {
                accountSid: credentials.accountSid ? 'presente' : 'ausente',
                apiKeySid: credentials.apiKeySid ? 'presente' : 'ausente',
                apiKeySecret: credentials.apiKeySecret ? 'presente' : 'ausente',
                twimlAppSid: credentials.twimlAppSid ? 'presente' : 'ausente',
                twilioPhoneNumber: credentials.twilioPhoneNumber ? 'presente' : 'ausente'
            });

            // Solicitar token al backend
            console.log('DEBUG: Solicitando token al backend...');
            const token = await this.getAccessToken(credentials);
            if (!token) {
                console.error('DEBUG: No se pudo obtener el token de acceso');
                throw new Error('No se pudo obtener el token de acceso');
            }
            console.log('DEBUG: Token obtenido exitosamente');

            // Configurar Twilio.Device
            console.log('DEBUG: Configurando Twilio.Device...');
            await this.setupDevice(token);
            console.log('DEBUG: Twilio.Device configurado exitosamente');
            
            this.isConnected = true;
            this.updateStatus('Conectado', 'connected');
            this.enableCallControls(true);
            
            console.log('DEBUG: Conexión completada exitosamente');
            return true;
        } catch (error) {
            console.error('DEBUG: Error en proceso de conexión:', error);
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
            console.log('DEBUG: Enviando solicitud de token al backend');
            console.log('DEBUG: URL de solicitud:', `${this.backendUrl}/token`);
            console.log('DEBUG: Método: POST');
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
            console.log('DEBUG: Status text:', response.statusText);
            console.log('DEBUG: Headers de respuesta:', Object.fromEntries(response.headers.entries()));

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
            console.log('DEBUG: Datos de respuesta parseados exitosamente');
            console.log('DEBUG: Token recibido:', data.token ? 'presente' : 'ausente');
            
            return data.token;
        } catch (error) {
            console.error('DEBUG: Error en getAccessToken:', error);
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
                console.log('DEBUG: Iniciando configuración del dispositivo Twilio');
                console.log('DEBUG: Token recibido para configuración:', token ? 'presente' : 'ausente');
                
                // Verificar permisos de micrófono antes de configurar el device
                console.log('DEBUG: Verificando permisos de micrófono...');
                this.checkMicrophonePermissions().then((result) => {
                    if (result && result.status === 'warning') {
                        console.warn('DEBUG: Verificación de micrófono omitida:', result.message);
                        console.warn('DEBUG: Continuando con configuración de Twilio Device...');
                    } else {
                        console.log('DEBUG: Permisos de micrófono verificados exitosamente');
                    }
                    
                    console.log('DEBUG: Creando instancia de Twilio.Device');
                    
                    // Configuraciones especiales para contextos HTTP donde getUserMedia puede fallar
                    const deviceOptions = {
                        debug: true,
                        answerOnBridge: true,
                        allowIncomingWhileBusy: false,
                        // Configurar codecs preferidos para mejor compatibilidad
                        codecPreferences: ['pcmu', 'opus'],
                        // Configuraciones adicionales para mejorar compatibilidad
                        disableAudioContextSounds: false,
                        logLevel: 'debug',
                        maxCallSignalingTimeoutMs: 30000
                    };
                    
                    // Solo agregar funciones personalizadas si estamos en contexto HTTPS
                    // En HTTP, Twilio manejará los errores internamente
                    if (location.protocol === 'https:') {
                        console.log('DEBUG: Contexto HTTPS detectado, agregando funciones personalizadas');
                        
                        deviceOptions.getUserMedia = async (constraints) => {
                            console.log('DEBUG: getUserMedia personalizado llamado con constraints:', constraints);
                            return await navigator.mediaDevices.getUserMedia(constraints);
                        };
                        
                        deviceOptions.enumerateDevices = async () => {
                            console.log('DEBUG: enumerateDevices personalizado llamado');
                            return await navigator.mediaDevices.enumerateDevices();
                        };
                    } else {
                        console.log('DEBUG: Contexto HTTP detectado, usando configuración básica sin funciones personalizadas');
                        console.log('DEBUG: Twilio manejará los errores de getUserMedia internamente');
                    }
                    console.log('DEBUG: Opciones del dispositivo configuradas:', deviceOptions);
                    
                    // Configurar Twilio Device con el nuevo SDK (2.0+)
                    // El token se pasa directamente al constructor
                    this.device = new Twilio.Device(token, deviceOptions);
                    
                    console.log('DEBUG: Twilio Device creado exitosamente, configurando event listeners...');
                    
                    // Event listeners
                    this.device.on('registered', () => {
                        console.log('DEBUG: Evento "registered" disparado');
                        console.log('DEBUG: Twilio.Device está registrado y listo');
                        console.log('Twilio.Device está registrado y listo');
                        resolve();
                    });

                    this.device.on('error', (error) => {
                        console.error('DEBUG: Evento "error" disparado en dispositivo');
                        
                        // Usar el nuevo manejador de errores con diagnóstico
                        const errorMessage = this.handleTwilioError(error, 'dispositivo');
                        this.showError(errorMessage);
                        reject(error);
                    });
                    
                    this.device.on('tokenWillExpire', () => {
                        console.log('DEBUG: Evento "tokenWillExpire" disparado');
                        console.log('DEBUG: Token expirará pronto, renovando...');
                        this.refreshToken();
                    });
                    
                    this.device.on('connect', (call) => {
                        console.log('DEBUG: Evento "connect" disparado');
                        console.log('DEBUG: Objeto de llamada:', call);
                        console.log('Llamada conectada');
                        this.currentCall = call;
                        this.onCallConnected(call);
                    });

                    this.device.on('disconnect', (call) => {
                        console.log('DEBUG: Evento "disconnect" disparado');
                        console.log('DEBUG: Objeto de llamada desconectada:', call);
                        console.log('Llamada desconectada');
                        this.onCallDisconnected(call);
                    });

                    this.device.on('incoming', (call) => {
                        console.log('DEBUG: Evento "incoming" disparado');
                        console.log('DEBUG: Llamada entrante recibida:', call);
                        console.log('Llamada entrante');
                        this.onIncomingCall(call);
                    });

                    this.device.on('cancel', () => {
                        console.log('DEBUG: Evento "cancel" disparado');
                        console.log('DEBUG: Llamada cancelada');
                        console.log('Llamada cancelada');
                        this.onCallDisconnected();
                    });
                    
                    console.log('DEBUG: Event listeners configurados exitosamente');
                    
                    // Registrar el device para recibir llamadas entrantes
                    console.log('DEBUG: Registrando device...');
                    this.device.register();
                    console.log('DEBUG: Comando de registro enviado');
                    
                }).catch((error) => {
                    console.error('DEBUG: Error verificando permisos de micrófono:', error);
                    console.error('DEBUG: Tipo de error:', error.constructor.name);
                    console.error('DEBUG: Stack trace:', error.stack);
                    
                    // Si el error es por getUserMedia no soportado, intentamos continuar
                    if (error.message && error.message.includes('getUserMedia no soportada')) {
                        console.warn('DEBUG: Continuando sin verificación de micrófono...');
                        console.warn('DEBUG: Twilio manejará los permisos durante la llamada');
                        
                        try {
                            console.log('DEBUG: Creando instancia de Twilio.Device sin verificación previa');
                            const deviceOptions = {
                                debug: true,
                                answerOnBridge: true,
                                allowIncomingWhileBusy: false
                            };
                            
                            this.device = new Twilio.Device(token, deviceOptions);
                            
                            // Event listeners (mismo código que arriba)
                            this.device.on('registered', () => {
                                console.log('DEBUG: Evento "registered" disparado');
                                console.log('DEBUG: Twilio.Device está registrado y listo');
                                console.log('Twilio.Device está registrado y listo');
                                resolve();
                            });

                            this.device.on('error', (error) => {
                                console.error('DEBUG: Evento "error" disparado en dispositivo');
                                const errorMessage = this.handleTwilioError(error, 'dispositivo');
                                this.showError(errorMessage);
                                reject(error);
                            });
                            
                            // Registrar el device
                            console.log('DEBUG: Registrando device sin verificación previa...');
                            this.device.register();
                            
                        } catch (deviceError) {
                            console.error('DEBUG: Error creando device sin verificación:', deviceError);
                            reject(deviceError);
                        }
                    } else {
                        reject(error);
                    }
                });

            } catch (error) {
                console.error('DEBUG: Error en setupDevice:', error);
                console.error('DEBUG: Tipo de error:', error.constructor.name);
                console.error('DEBUG: Stack trace:', error.stack);
                reject(error);
            }
        });
    }

    /**
     * Verifica los permisos de micrófono
     * @returns {Promise} Promesa que se resuelve cuando los permisos son concedidos
     */
    async checkMicrophonePermissions() {
        try {
            console.log('DEBUG: Verificando permisos de micrófono...');
            console.log('DEBUG: Navegador:', navigator.userAgent);
            console.log('DEBUG: mediaDevices disponible:', !!navigator.mediaDevices);
            console.log('DEBUG: Protocolo actual:', window.location.protocol);
            console.log('DEBUG: Host actual:', window.location.host);
            
            // Verificar si mediaDevices está disponible
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('DEBUG: API getUserMedia no disponible - posiblemente debido a contexto HTTP');
                console.warn('DEBUG: Twilio puede funcionar sin verificación previa de micrófono');
                console.warn('DEBUG: Los permisos se solicitarán cuando se inicie la llamada');
                return { 
                    status: 'warning', 
                    message: 'Verificación de micrófono omitida - se solicitarán permisos durante la llamada',
                    reason: 'getUserMedia no disponible (posiblemente contexto HTTP)'
                };
            }
            
            // Listar dispositivos disponibles para diagnóstico
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                console.log('DEBUG: Dispositivos de audio disponibles:', audioInputs.length);
                audioInputs.forEach((device, index) => {
                    console.log(`DEBUG: Dispositivo de audio ${index + 1}:`, {
                        deviceId: device.deviceId ? 'presente' : 'ausente',
                        groupId: device.groupId ? 'presente' : 'ausente',
                        label: device.label || 'Sin etiqueta (requiere permisos)'
                    });
                });
                
                if (audioInputs.length === 0) {
                    console.error('DEBUG: No se encontraron dispositivos de audio');
                    throw new Error('No se encontraron dispositivos de audio. Por favor, conecte un micrófono.');
                }
            } catch (enumError) {
                console.error('DEBUG: Error al enumerar dispositivos:', enumError);
                // Continuamos con getUserMedia aunque falle la enumeración
            }
            
            // Configuración específica para solucionar problemas de adquisición
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };
            console.log('DEBUG: Solicitando permisos con constraints:', constraints);
            
            // Solicitar permisos de micrófono
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('DEBUG: Permisos de micrófono concedidos');
            console.log('DEBUG: Stream obtenido:', !!stream);
            console.log('DEBUG: Tracks de audio:', stream.getAudioTracks().length);
            
            // Verificar que realmente tenemos tracks de audio
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.error('DEBUG: No se obtuvieron tracks de audio a pesar de tener stream');
                throw new Error('No se pudo acceder al micrófono a pesar de tener permisos');
            }
            
            // Mostrar información de los tracks para diagnóstico
            audioTracks.forEach((track, index) => {
                console.log(`DEBUG: Track de audio ${index + 1}:`, {
                    id: track.id,
                    label: track.label,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState
                });
                
                // Verificar si el track está realmente activo
                if (track.readyState !== 'live') {
                    console.error(`DEBUG: Track de audio ${index + 1} no está activo:`, track.readyState);
                }
            });
            
            // Detener el stream para liberar el micrófono
            console.log('DEBUG: Deteniendo stream de prueba...');
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('DEBUG: Track detenido:', track.id);
            });
            
            console.log('DEBUG: Verificación de micrófono completada exitosamente');
            return true;
            
        } catch (error) {
            console.error('DEBUG: Error al verificar permisos de micrófono:', error);
            console.error('DEBUG: Tipo de error:', error.constructor.name);
            console.error('DEBUG: Nombre del error:', error.name);
            console.error('DEBUG: Mensaje del error:', error.message);
            console.error('DEBUG: Stack trace:', error.stack);
            console.error('Error al verificar permisos de micrófono:', error);
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('Permisos de micrófono denegados. Por favor, permita el acceso al micrófono.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                throw new Error('No se encontró un micrófono. Por favor, conecte un micrófono y vuelva a intentarlo.');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                throw new Error('El micrófono está siendo utilizado por otra aplicación. Por favor, cierre otras aplicaciones que puedan estar usando el micrófono.');
            } else if (error.name === 'OverconstrainedError') {
                throw new Error('Las restricciones de audio no pueden ser satisfechas. Intente con un dispositivo de audio diferente.');
            } else if (error.name === 'TypeError') {
                throw new Error('Configuración de audio inválida. Por favor, recargue la página e intente nuevamente.');
            } else {
                throw new Error(`Error de micrófono: ${error.message}`);
            }
        }
    }

    /**
     * Renueva el token de acceso
     */
    async refreshToken() {
        try {
            console.log('DEBUG: Renovando token de acceso...');
            
            // Obtener credenciales
            const credentials = window.twilioCredentials.getForBackend();
            if (!credentials) {
                console.error('DEBUG: No hay credenciales para renovar token');
                throw new Error('No hay credenciales disponibles para renovar token');
            }
            
            // Obtener nuevo token
            const newToken = await this.getAccessToken(credentials);
            if (!newToken) {
                console.error('DEBUG: No se pudo obtener nuevo token');
                throw new Error('No se pudo obtener nuevo token');
            }
            
            // Actualizar token en el dispositivo
            if (this.device) {
                console.log('DEBUG: Actualizando token en el dispositivo...');
                this.device.updateToken(newToken);
                console.log('DEBUG: Token actualizado exitosamente');
            }
            
        } catch (error) {
            console.error('DEBUG: Error renovando token:', error);
            console.error('Error renovando token:', error);
            this.showError(`Error renovando token: ${error.message}`);
        }
    }
    
    /**
     * Diagnostica problemas del dispositivo Twilio
     */
    diagnoseTwilioDevice() {
        console.log('DEBUG: ========== DIAGNÓSTICO DEL DISPOSITIVO TWILIO ==========');
        
        if (!this.device) {
            console.log('DEBUG: No hay dispositivo Twilio configurado');
            return;
        }
        
        console.log('DEBUG: Estado del dispositivo:', this.device.state);
        console.log('DEBUG: ¿Dispositivo registrado?:', this.device.state === 'registered');
        console.log('DEBUG: ¿Dispositivo ocupado?:', this.device.isBusy);
        console.log('DEBUG: Versión del SDK:', this.device.version || 'No disponible');
        
        // Verificar capacidades del dispositivo
        if (this.device.audio) {
            console.log('DEBUG: Audio disponible:', !!this.device.audio);
            console.log('DEBUG: Dispositivos de entrada:', this.device.audio.availableInputDevices?.length || 'No disponible');
            console.log('DEBUG: Dispositivos de salida:', this.device.audio.availableOutputDevices?.length || 'No disponible');
            
            if (this.device.audio.availableInputDevices) {
                this.device.audio.availableInputDevices.forEach((device, index) => {
                    console.log(`DEBUG: Dispositivo de entrada ${index + 1}:`, {
                        deviceId: device.deviceId,
                        label: device.label
                    });
                });
            }
        }
        
        // Verificar llamada actual
        if (this.currentCall) {
            console.log('DEBUG: Llamada actual presente:', !!this.currentCall);
            console.log('DEBUG: Estado de llamada:', this.currentCall.status);
            console.log('DEBUG: Dirección de llamada:', this.currentCall.direction);
        } else {
            console.log('DEBUG: No hay llamada activa');
        }
        
        console.log('DEBUG: ========== FIN DEL DIAGNÓSTICO ==========');
    }
    
    /**
     * Maneja errores específicos de Twilio con diagnóstico detallado
     * @param {Error} error - Error de Twilio
     * @param {string} context - Contexto donde ocurrió el error
     */
    handleTwilioError(error, context = 'Operación desconocida') {
        console.error(`DEBUG: ========== ERROR DE TWILIO EN ${context.toUpperCase()} ==========`);
        console.error('DEBUG: Tipo de error:', error.constructor.name);
        console.error('DEBUG: Código de error:', error.code);
        console.error('DEBUG: Mensaje:', error.message);
        console.error('DEBUG: Stack trace:', error.stack);
        
        // Ejecutar diagnóstico del dispositivo
        this.diagnoseTwilioDevice();
        
        // Manejo específico por código de error
        switch (error.code) {
            case 31402: // AcquisitionFailedError
                console.error('DEBUG: Error 31402 - Fallo en adquisición de medios');
                console.error('DEBUG: Posibles causas:');
                console.error('DEBUG: - Micrófono en uso por otra aplicación');
                console.error('DEBUG: - Problemas de hardware del micrófono');
                console.error('DEBUG: - Restricciones de audio incompatibles');
                console.error('DEBUG: - Problemas del navegador con WebRTC');
                return 'Error de micrófono: No se pudo acceder al micrófono. Verifique que no esté siendo usado por otra aplicación y que funcione correctamente.';
                
            case 31003: // AuthorizationError
                console.error('DEBUG: Error 31003 - Error de autorización');
                return 'Error de autorización: Verifique sus credenciales de Twilio.';
                
            case 31005: // ConnectionError
                console.error('DEBUG: Error 31005 - Error de conexión');
                return 'Error de conexión: Verifique su conexión a internet.';
                
            case 31201: // MicrophoneAcquisitionError
                console.error('DEBUG: Error 31201 - Error de adquisición de micrófono');
                return 'Error de micrófono: No se pudo acceder al micrófono. Verifique los permisos.';
                
            default:
                console.error('DEBUG: Error no categorizado:', error.code);
                return `Error: ${error.message}`;
        }
    }

    /**
     * Realiza una llamada saliente
     * @param {string} phoneNumber - Número a llamar
     */
    async makeCall(phoneNumber) {
        try {
            console.log('DEBUG: ========== INICIANDO PROCESO DE LLAMADA ==========');
            console.log('DEBUG: Número a llamar:', phoneNumber);
            console.log('DEBUG: Timestamp:', new Date().toISOString());
            
            // Verificaciones previas
            console.log('DEBUG: Verificando estado del dispositivo...');
            if (!this.device || !this.isConnected) {
                console.error('DEBUG: Device no está conectado');
                throw new Error('Device no está conectado');
            }
            console.log('DEBUG: Device está disponible:', !!this.device);
            console.log('DEBUG: Estado de conexión:', this.isConnected);

            if (this.currentCall) {
                console.error('DEBUG: Ya hay una llamada en curso');
                throw new Error('Ya hay una llamada en curso');
            }
            console.log('DEBUG: No hay llamadas activas');

            // Validar número
            console.log('DEBUG: Validando número de teléfono...');
            if (!phoneNumber || phoneNumber.trim() === '') {
                console.error('DEBUG: Número de teléfono vacío');
                throw new Error('Debe ingresar un número de teléfono');
            }

            // Limpiar y formatear número
            const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
            console.log('DEBUG: Número original:', phoneNumber);
            console.log('DEBUG: Número limpio:', cleanNumber);
            
            if (!cleanNumber.startsWith('+')) {
                console.error('DEBUG: Número sin código de país');
                throw new Error('El número debe incluir código de país (+)');
            }
            console.log('DEBUG: Número validado correctamente');

            // Verificar estado del dispositivo
            console.log('DEBUG: Estado del dispositivo Twilio:', this.device.state);
            console.log('DEBUG: ¿Dispositivo registrado?:', this.device.state === 'registered');
            
            console.log('DEBUG: Device conectado, verificando permisos de micrófono...');
            
            // Verificar permisos de micrófono antes de hacer la llamada
            try {
                await this.checkMicrophonePermissions();
                console.log('DEBUG: Permisos verificados, procediendo con la llamada');
            } catch (micError) {
                console.error('DEBUG: Error de permisos de micrófono:', micError);
                this.showError(micError.message);
                return;
            }

            this.updateStatus('Realizando llamada...', 'connecting');
            console.log('DEBUG: Estado actualizado a "Realizando llamada..."');
            
            // Preparar parámetros de llamada
            const callParams = {
                To: cleanNumber
            };
            console.log('DEBUG: Parámetros de llamada:', callParams);
            console.log('DEBUG: Método de conexión disponible:', typeof this.device.connect);
            
            console.log('DEBUG: Ejecutando device.connect()...');
            
            // Realizar llamada
            const call = await this.device.connect(callParams);

            console.log('DEBUG: device.connect() ejecutado');
            console.log('DEBUG: Llamada iniciada exitosamente');
            console.log('DEBUG: Objeto de llamada recibido:', call);
            console.log('DEBUG: Tipo de objeto de llamada:', typeof call);
            console.log('DEBUG: Estado de la llamada:', call ? call.status : 'undefined');
            
            this.currentCall = call;
            console.log('DEBUG: currentCall asignado');
            
            // Configurar event listeners para esta llamada específica
            console.log('DEBUG: Configurando event listeners para la llamada...');
            
            call.on('accept', () => {
                console.log('DEBUG: Evento "accept" disparado');
                console.log('Llamada aceptada');
                this.onCallConnected(call);
            });
            
            call.on('disconnect', () => {
                console.log('DEBUG: Evento "disconnect" disparado en llamada');
                console.log('Llamada desconectada');
                this.onCallDisconnected(call);
            });
            
            call.on('cancel', () => {
                console.log('DEBUG: Evento "cancel" disparado en llamada');
                console.log('Llamada cancelada');
                this.onCallDisconnected(call);
            });
            
            call.on('error', (error) => {
                 console.error('DEBUG: Evento "error" disparado en llamada:', error);
                 
                 // Usar el nuevo manejador de errores con diagnóstico
                 const errorMessage = this.handleTwilioError(error, 'llamada');
                 this.showError(errorMessage);
                 this.updateStatus('Error en llamada', 'error');
             });
            
            console.log('DEBUG: Event listeners configurados exitosamente');
            console.log('DEBUG: ========== PROCESO DE LLAMADA COMPLETADO ==========');
            
        } catch (error) {
            console.error('DEBUG: ========== ERROR EN PROCESO DE LLAMADA ==========');
            console.error('DEBUG: Error realizando llamada:', error);
            
            // Usar el nuevo manejador de errores con diagnóstico
            const errorMessage = this.handleTwilioError(error, 'makeCall');
            this.showError(errorMessage);
            
            this.updateStatus('Conectado', 'connected');
            console.error('DEBUG: ========== FIN DE MANEJO DE ERROR ==========');
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
        console.log('DEBUG: onCallConnected ejecutado');
        console.log('Llamada conectada exitosamente');
        
        console.log('DEBUG: Mostrando información de llamada');
        this.showCallInfo(call);
        
        console.log('DEBUG: Iniciando timer de llamada');
        this.startCallTimer();
        
        console.log('DEBUG: Habilitando controles de llamada activa');
        this.enableCallControls(true, true); // Habilitar controles de llamada activa
        
        console.log('DEBUG: Actualizando estado a "En llamada"');
        this.updateStatus('En llamada', 'connected');
    }

    /**
     * Maneja el evento de llamada desconectada
     */
    onCallDisconnected(call) {
        console.log('DEBUG: onCallDisconnected ejecutado');
        console.log('Llamada desconectada');
        
        console.log('DEBUG: Ocultando información de llamada');
        this.hideCallInfo();
        this.hideIncomingCall();
        
        console.log('DEBUG: Deteniendo timer de llamada');
        this.stopCallTimer();
        
        console.log('DEBUG: Limpiando estado de llamada');
        this.currentCall = null;
        this.isMuted = false;
        this.isOnHold = false;
        
        console.log('DEBUG: Deshabilitando controles de llamada activa');
        this.enableCallControls(true, false); // Deshabilitar controles de llamada activa
        
        console.log('DEBUG: Actualizando estado a "Conectado"');
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