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
        this.backendUrl = 'https://twilio.neox.site'; // URL del backend Flask en VPS
        
        // Variables para rastrear información de llamadas
        this.currentCallPhoneNumber = null;
        this.currentCallType = null;
        this.currentCallStartTime = null;
        
        // Bind methods
        this.setupDevice = this.setupDevice.bind(this);
        this.makeCall = this.makeCall.bind(this);
        this.acceptCall = this.acceptCall.bind(this);
        this.rejectCall = this.rejectCall.bind(this);
        
        // Configurar event delegation universal para el botón de colgar
        this.setupUniversalHangupHandler();
        
        // Cargar historial de llamadas al inicializar
        setTimeout(() => this.loadCallHistory(), 1000);
        
        // Inicializar funciones de contactos
        this.setupContactEventListeners();
        
        // Cargar contactos con un pequeño retraso
        setTimeout(() => {
            this.loadContacts();
        }, 1500);
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
            
            // Mostrar pantalla de carga
            this.showLoadingScreen();
            
            // Verificaciones previas
            console.log('DEBUG: Verificando estado del dispositivo...');
            if (!this.device || !this.isConnected) {
                console.error('DEBUG: Device no está conectado');
                this.hideLoadingScreen();
                throw new Error('Device no está conectado');
            }
            console.log('DEBUG: Device está disponible:', !!this.device);
            console.log('DEBUG: Estado de conexión:', this.isConnected);

            if (this.currentCall) {
                console.error('DEBUG: Ya hay una llamada en curso');
                this.hideLoadingScreen();
                throw new Error('Ya hay una llamada en curso');
            }
            console.log('DEBUG: No hay llamadas activas');

            // Validar número
            console.log('DEBUG: Validando número de teléfono...');
            if (!phoneNumber || phoneNumber.trim() === '') {
                console.error('DEBUG: Número de teléfono vacío');
                this.hideLoadingScreen();
                throw new Error('Debe ingresar un número de teléfono');
            }

            // Limpiar y formatear número
            const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
            console.log('DEBUG: Número original:', phoneNumber);
            console.log('DEBUG: Número limpio:', cleanNumber);
            
            // Registrar información de la llamada saliente
            this.currentCallPhoneNumber = cleanNumber;
            this.currentCallType = 'outgoing';
            this.currentCallStartTime = new Date();
            
            if (!cleanNumber.startsWith('+')) {
                console.error('DEBUG: Número sin código de país');
                this.hideLoadingScreen();
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
            
            // Obtener el número de Twilio del usuario desde las credenciales
            const credentials = window.twilioCredentials.getForBackend();
            const userTwilioNumber = credentials.twilioPhoneNumber;
            console.log('DEBUG: Número de Twilio del usuario:', userTwilioNumber);
            
            // Los nombres 'ToNumber' y 'FromNumber' son los que nuestro backend ahora buscará
            // (con el prefijo 'Parameter' añadido por Twilio)
            // 'To' es el parámetro estándar que Twilio espera para el número de destino.
            // 'FromNumber' es nuestro parámetro personalizado para el caller_id.
            const callParams = {
                PhoneNumber: cleanNumber,    // Usamos un nombre personalizado para evitar conflictos
                FromNumber: userTwilioNumber // El número de Twilio del usuario que usaremos como Caller ID
            };
            console.log('DEBUG: Parámetros de llamada:', callParams);
            console.log('DEBUG: Método de conexión disponible:', typeof this.device.connect);
            
            console.log('DEBUG: Ejecutando device.connect()...');
            
            // Realizar llamada
            const call = await this.device.connect({ params: callParams });

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
            
            // Ocultar pantalla de carga en caso de error
            this.hideLoadingScreen();
            
            // Usar el nuevo manejador de errores con diagnóstico
            const errorMessage = this.handleTwilioError(error, 'makeCall');
            this.showError(errorMessage);
            
            this.updateStatus('Desconectado', 'disconnected');
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
        console.log('DEBUG: Función hangup ejecutada');
        console.log('DEBUG: currentCall existe:', !!this.currentCall);
        
        if (this.currentCall) {
            console.log('DEBUG: Desconectando llamada...');
            // Verificar si es una llamada real con método disconnect
            if (typeof this.currentCall.disconnect === 'function') {
                this.currentCall.disconnect();
            } else {
                console.log('DEBUG: Llamada de prueba - no se requiere disconnect');
            }
            this.currentCall = null;
            console.log('DEBUG: Ocultando modal...');
            this.hideCallControlModal();
            console.log('DEBUG: Mostrando mensaje de éxito...');
            this.showSuccess('Llamada terminada');
            console.log('DEBUG: Hangup completado');
        } else {
            console.warn('DEBUG: No hay llamada activa para colgar');
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
        if (this.currentCall) {
            this.isOnHold = !this.isOnHold;
            const holdButton = document.getElementById('holdButton');
            
            if (this.isOnHold) {
                // Poner en retención (silenciar ambos lados)
                this.currentCall.mute(true);
                if (holdButton) {
                    holdButton.classList.add('active');
                }
                this.showSuccess('Llamada en retención');
            } else {
                // Quitar de retención
                this.currentCall.mute(this.isMuted); // Restaurar estado de mute original
                if (holdButton) {
                    holdButton.classList.remove('active');
                }
                this.showSuccess('Llamada reanudada');
            }
        }
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
        
        // Ocultar pantalla de carga cuando la llamada se conecta
        this.hideLoadingScreen();
        
        console.log('DEBUG: Mostrando modal de control de llamada');
        this.showCallControlModal(call);
        
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
        
        console.log('DEBUG: Ocultando modal de control de llamada');
        this.hideCallControlModal();
        this.hideIncomingCall();
        
        console.log('DEBUG: Deteniendo timer de llamada');
        this.stopCallTimer();
        
        // Registrar la llamada antes de limpiar el estado
        if (this.currentCallPhoneNumber && this.currentCallStartTime) {
            const endTime = new Date();
            const duration = Math.floor((endTime - this.currentCallStartTime) / 1000);
            this.registerCall(this.currentCallPhoneNumber, this.currentCallType, duration);
        }
        
        console.log('DEBUG: Limpiando estado de llamada');
        this.currentCall = null;
        this.currentCallPhoneNumber = null;
        this.currentCallType = null;
        this.currentCallStartTime = null;
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
        
        // Registrar información de la llamada entrante
        this.currentCallPhoneNumber = call.parameters.From || 'Desconocido';
        this.currentCallType = 'incoming';
        this.currentCallStartTime = new Date();
        
        this.showIncomingCall(call);
    }

    /**
     * Actualiza el estado de conexión en la UI
     */
    updateStatus(message, status) {
        const statusElement = document.getElementById('connection-status');
        const messagesElement = document.getElementById('status-messages');
        const connectionIcon = document.getElementById('connectionIcon');
        const connectionStatus = document.getElementById('connectionStatus');
        
        // Actualizar el icono de conexión en el header
        if (connectionIcon) {
            connectionIcon.className = 'bx bx-wifi';
            const iconParent = connectionIcon.parentElement;
            if (iconParent) {
                // Remover clases previas
                iconParent.classList.remove('bg-label-success', 'bg-label-secondary', 'bg-label-warning');
                
                switch (status) {
                    case 'connected':
                        iconParent.classList.add('bg-label-success');
                        break;
                    case 'connecting':
                        iconParent.classList.add('bg-label-warning');
                        break;
                    case 'disconnected':
                    default:
                        iconParent.classList.add('bg-label-secondary');
                        break;
                }
            }
        }
        
        // Actualizar el texto de estado de conexión
        if (connectionStatus) {
            switch (status) {
                case 'connected':
                    connectionStatus.textContent = 'Conectado';
                    break;
                case 'connecting':
                    connectionStatus.textContent = 'Conectando...';
                    break;
                case 'disconnected':
                default:
                    connectionStatus.textContent = 'Desconectado';
                    break;
            }
        }
        
        // Mantener compatibilidad con el elemento de estado existente
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
        const callButton = document.getElementById('callButton');
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
        // Actualizar botón original
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
        
        // Actualizar botón del modal
        const modalMuteButton = document.getElementById('muteButton');
        if (modalMuteButton) {
            if (this.isMuted) {
                modalMuteButton.classList.add('active');
            } else {
                modalMuteButton.classList.remove('active');
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
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true
            });
        } else {
            console.error('Error:', message);
        }
    }

    showSuccess(message) {
        if (window.Swal) {
            Swal.fire({
                icon: 'success',
                title: 'Éxito',
                text: message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } else {
            console.log('Success:', message);
        }
    }

    /**
     * Muestra la pantalla de carga
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    /**
     * Oculta la pantalla de carga
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    /**
     * Muestra el modal de control de llamadas
     */
    showCallControlModal(call) {
        const modal = document.getElementById('callControlModal');
        const titleElement = document.getElementById('callControlTitle');
        const numberElement = document.getElementById('callControlNumber');
        
        if (modal && titleElement && numberElement) {
            // Obtener número de teléfono
            const phoneNumber = call.parameters?.To || call.parameters?.From || 'Número desconocido';
            
            // Actualizar contenido del modal
            titleElement.textContent = 'En llamada';
            numberElement.textContent = phoneNumber;
            
            // Configurar event listeners para los controles ANTES de mostrar el modal
            this.setupCallControlEventListeners();
            
            // Mostrar modal
            try {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const bsModal = new bootstrap.Modal(modal);
                    bsModal.show();
                } else {
                    // Fallback: mostrar modal manualmente
                    modal.style.display = 'block';
                    modal.classList.add('show');
                    document.body.classList.add('modal-open');
                    
                    // Crear backdrop
                    const backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    backdrop.id = 'callModalBackdrop';
                    document.body.appendChild(backdrop);
                }
                console.log('Modal de control de llamadas mostrado');
            } catch (error) {
                console.error('Error mostrando modal:', error);
                // Fallback manual
                modal.style.display = 'block';
                modal.classList.add('show');
            }
        } else {
            console.error('Elementos del modal no encontrados:', {
                modal: !!modal,
                titleElement: !!titleElement,
                numberElement: !!numberElement
            });
        }
    }

    /**
     * Oculta el modal de control de llamadas
     */
    hideCallControlModal() {
        const modal = document.getElementById('callControlModal');
        if (modal) {
            try {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    } else {
                        // Fallback manual
                        this.hideModalManually(modal);
                    }
                } else {
                    // Fallback manual
                    this.hideModalManually(modal);
                }
            } catch (error) {
                console.error('Error ocultando modal:', error);
                // Fallback manual
                this.hideModalManually(modal);
            }
        }
        
        // Limpiar el timer de duración
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }
    }

    /**
     * Oculta el modal manualmente (fallback)
     */
    hideModalManually(modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        
        // Remover backdrop
        const backdrop = document.getElementById('callModalBackdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }

    /**
     * Configura los event listeners para los controles del modal
     */
    setupCallControlEventListeners() {
        console.log('DEBUG: Configurando event listeners del modal');
        
        // Botón de colgar
        const hangupButton = document.getElementById('hangupButton');
        console.log('DEBUG: Botón de colgar encontrado:', !!hangupButton);
        if (hangupButton) {
            // Remover event listeners previos
            hangupButton.onclick = null;
            hangupButton.removeEventListener('click', this.hangupHandler);
            
            // Crear nuevo handler
            this.hangupHandler = () => {
                console.log('DEBUG: Botón de colgar clickeado');
                this.hangup();
            };
            
            // Agregar event listener
            hangupButton.addEventListener('click', this.hangupHandler);
            console.log('DEBUG: Event listener de colgar configurado');
        } else {
            console.error('DEBUG: Botón de colgar no encontrado en el DOM');
        }

        // Botón de silenciar
        const muteButton = document.getElementById('muteButton');
        if (muteButton) {
            muteButton.onclick = () => this.toggleMute();
        }

        // Botón de retener
        const holdButton = document.getElementById('holdButton');
        if (holdButton) {
            holdButton.onclick = () => this.toggleHold();
        }

        // Botón de altavoz
        const speakerButton = document.getElementById('speakerButton');
        if (speakerButton) {
            speakerButton.onclick = () => this.toggleSpeaker();
        }

        // Toggle del teclado
        const keypadToggle = document.getElementById('keypadToggle');
        if (keypadToggle) {
            keypadToggle.onclick = () => this.toggleKeypad();
        }

        // Botones del dialpad DTMF - enviar tonos directamente
        const dtmfButtons = document.querySelectorAll('#callDialpadGrid [data-dtmf]');
        dtmfButtons.forEach(button => {
            button.onclick = () => this.sendDtmfTone(button.dataset.dtmf);
        });

        // Botón limpiar DTMF (mantener para limpiar el display)
        const clearDtmfButton = document.getElementById('clearDtmfButton');
        if (clearDtmfButton) {
            clearDtmfButton.onclick = () => this.clearDtmf();
        }
    }

    /**
     * Alterna la visibilidad del teclado DTMF
     */
    toggleKeypad() {
        const keypad = document.getElementById('callDialpad');
        const keypadToggle = document.getElementById('keypadToggle');
        
        if (keypad && keypadToggle) {
            if (keypad.style.display === 'none' || keypad.style.display === '') {
                keypad.style.display = 'flex';
                keypadToggle.classList.add('active');
            } else {
                keypad.style.display = 'none';
                keypadToggle.classList.remove('active');
            }
        }
    }

    /**
     * Envía un tono DTMF individual directamente
     */
    sendDtmfTone(digit) {
        if (this.currentCall && digit) {
            try {
                this.currentCall.sendDigits(digit);
                this.showSuccess(`Tono DTMF enviado: ${digit}`);
                
                // Mostrar el dígito en el input para referencia visual
                const dtmfInput = document.getElementById('dtmfInput');
                if (dtmfInput) {
                    dtmfInput.value += digit;
                }
            } catch (error) {
                console.error('Error enviando DTMF:', error);
                this.showError('Error enviando tono DTMF');
            }
        }
    }

    /**
     * Agrega un dígito al input DTMF (solo para display)
     */
    addDtmfDigit(digit) {
        const dtmfInput = document.getElementById('dtmfInput');
        if (dtmfInput) {
            dtmfInput.value += digit;
        }
    }

    /**
     * Limpia el input DTMF
     */
    clearDtmf() {
        const dtmfInput = document.getElementById('dtmfInput');
        if (dtmfInput) {
            dtmfInput.value = '';
        }
    }



    /**
     * Alterna el estado del altavoz
     */
    toggleSpeaker() {
        // Nota: Twilio Voice SDK no tiene control directo del altavoz
        // Esta funcionalidad dependería de la implementación del navegador
        const speakerButton = document.getElementById('speakerButton');
        if (speakerButton) {
            speakerButton.classList.toggle('active');
            const isActive = speakerButton.classList.contains('active');
            this.showSuccess(isActive ? 'Altavoz activado' : 'Altavoz desactivado');
        }
    }



    /**
     * Inicia el timer de duración de la llamada
     */
    startCallTimer() {
        this.callStartTime = new Date();
        this.updateCallDuration();
        
        this.callDurationInterval = setInterval(() => {
            this.updateCallDuration();
        }, 1000);
    }

    /**
     * Detiene el timer de duración de la llamada
     */
    stopCallTimer() {
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }
        this.callStartTime = null;
    }

    /**
     * Actualiza la duración de la llamada en el modal
     */
    updateCallDuration() {
        const durationElement = document.getElementById('callDuration');
        if (durationElement && this.callStartTime) {
            const now = new Date();
            const duration = Math.floor((now - this.callStartTime) / 1000);
            
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            
            const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            durationElement.textContent = formattedDuration;
        }
    }

    /**
     * Función de prueba para mostrar el modal manualmente
     */
    testShowModal() {
        console.log('DEBUG: Mostrando modal de prueba');
        const mockCall = {
            parameters: {
                To: '+1234567890'
            }
        };
        this.currentCall = mockCall; // Simular llamada activa
        this.showCallControlModal(mockCall);
    }

    /**
     * Configura un event listener universal para el botón de colgar
     * usando event delegation para manejar botones creados dinámicamente
     */
    setupUniversalHangupHandler() {
        console.log('DEBUG: Configurando event listener universal para botón de colgar');
        
        // Usar event delegation en el document para capturar clics en cualquier botón de colgar
        document.addEventListener('click', (event) => {
            // Verificar si el elemento clickeado es el botón de colgar o está dentro de él
            if (event.target.id === 'hangupButton' || 
                event.target.closest('#hangupButton')) {
                
                console.log('DEBUG: Clic detectado en botón de colgar (event delegation)');
                event.preventDefault();
                event.stopPropagation();
                
                // Ejecutar la función de colgar
                this.hangup();
            }
        });
        
        console.log('DEBUG: Event listener universal configurado exitosamente');
    }

    /**
     * Agrega una llamada al registro de llamadas recientes
     * @param {Object} callData - Datos de la llamada
     */
    addToRecentCalls(callData) {
        console.log('DEBUG: Agregando llamada a llamadas recientes:', callData);
        
        const recentCallsList = document.getElementById('recentCallsList');
        if (!recentCallsList) {
            console.error('DEBUG: Elemento recentCallsList no encontrado');
            return;
        }

        // Crear el elemento de la llamada reciente
        const callElement = this.createCallElement(callData, 'recent');
        
        // Limpiar el mensaje de "no hay llamadas" si existe
        const noCallsMessage = recentCallsList.querySelector('.text-center.text-muted');
        if (noCallsMessage) {
            noCallsMessage.remove();
        }

        // Agregar la nueva llamada al inicio de la lista
        recentCallsList.insertBefore(callElement, recentCallsList.firstChild);
        
        // Mantener solo las últimas 5 llamadas recientes
        const callElements = recentCallsList.querySelectorAll('.call-item');
        if (callElements.length > 5) {
            callElements[callElements.length - 1].remove();
        }

        console.log('DEBUG: Llamada agregada a llamadas recientes');
    }

    /**
     * Agrega una llamada al historial completo de llamadas
     * @param {Object} callData - Datos de la llamada
     */
    addToCallHistory(callData) {
        console.log('DEBUG: Agregando llamada al historial:', callData);
        
        const callHistory = document.getElementById('callHistory');
        if (!callHistory) {
            console.error('DEBUG: Elemento callHistory no encontrado');
            return;
        }

        // Crear el elemento de la llamada para el historial
        const callElement = this.createCallElement(callData, 'history');
        
        // Limpiar el mensaje de "no hay historial" si existe
        const noHistoryMessage = callHistory.querySelector('.text-center.text-muted');
        if (noHistoryMessage) {
            noHistoryMessage.remove();
        }

        // Agregar la nueva llamada al inicio de la lista
        callHistory.insertBefore(callElement, callHistory.firstChild);

        console.log('DEBUG: Llamada agregada al historial');
    }

    /**
     * Crea un elemento HTML para mostrar una llamada
     * @param {Object} callData - Datos de la llamada
     * @param {string} type - Tipo de lista ('recent' o 'history')
     * @returns {HTMLElement} - Elemento HTML de la llamada
     */
    createCallElement(callData, type) {
        const callElement = document.createElement('div');
        callElement.className = 'call-item d-flex align-items-center p-3 border-bottom';
        
        // Determinar el icono según el tipo de llamada
        let iconClass = 'bx-phone';
        let iconColor = 'text-primary';
        
        if (callData.type === 'outgoing') {
            iconClass = 'bx-phone-outgoing';
            iconColor = 'text-success';
        } else if (callData.type === 'incoming') {
            iconClass = 'bx-phone-incoming';
            iconColor = 'text-info';
        } else if (callData.type === 'missed') {
            iconClass = 'bx-phone-off';
            iconColor = 'text-danger';
        }

        // Formatear la duración si existe
        const duration = callData.duration ? this.formatDuration(callData.duration) : 'No conectada';
        
        // Formatear la fecha
        const date = new Date(callData.timestamp);
        const timeString = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const dateString = type === 'history' ? date.toLocaleDateString('es-ES') : 'Hoy';

        callElement.innerHTML = `
            <div class="flex-shrink-0 me-3">
                <div class="avatar avatar-sm">
                    <span class="avatar-initial rounded-circle bg-label-primary">
                        <i class="bx ${iconClass} ${iconColor}"></i>
                    </span>
                </div>
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-0">${callData.phoneNumber}</h6>
                <small class="text-muted">${dateString} - ${timeString}</small>
                ${type === 'history' ? `<br><small class="text-muted">Duración: ${duration}</small>` : ''}
            </div>
            <div class="flex-shrink-0">
                <button class="btn btn-sm btn-outline-primary" onclick="window.twilioPhone.makeCall('${callData.phoneNumber}')">
                    <i class="bx bx-phone"></i>
                </button>
            </div>
        `;

        return callElement;
    }

    /**
     * Formatea la duración en segundos a formato mm:ss
     * @param {number} seconds - Duración en segundos
     * @returns {string} - Duración formateada
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Registra una llamada completada en ambas listas
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} type - Tipo de llamada ('outgoing', 'incoming', 'missed')
     * @param {number} duration - Duración en segundos (opcional)
     */
    registerCall(phoneNumber, type, duration = 0) {
        console.log('DEBUG: Registrando llamada:', { phoneNumber, type, duration });
        
        const callData = {
            phoneNumber: phoneNumber,
            type: type,
            duration: duration,
            timestamp: new Date().toISOString()
        };

        // Agregar a llamadas recientes
        this.addToRecentCalls(callData);
        
        // Agregar al historial completo
        this.addToCallHistory(callData);
        
        // Guardar en localStorage para persistencia
        this.saveCallToStorage(callData);
        
        console.log('DEBUG: Llamada registrada exitosamente');
    }

    /**
     * Guarda una llamada en localStorage para persistencia
     * @param {Object} callData - Datos de la llamada
     */
    saveCallToStorage(callData) {
        try {
            let callHistory = JSON.parse(localStorage.getItem('twilioCallHistory') || '[]');
            callHistory.unshift(callData);
            
            // Mantener solo las últimas 100 llamadas
            if (callHistory.length > 100) {
                callHistory = callHistory.slice(0, 100);
            }
            
            localStorage.setItem('twilioCallHistory', JSON.stringify(callHistory));
            console.log('DEBUG: Llamada guardada en localStorage');
        } catch (error) {
            console.error('DEBUG: Error al guardar llamada en localStorage:', error);
        }
    }

    /**
     * Carga el historial de llamadas desde localStorage
     */
    loadCallHistory() {
        try {
            const callHistory = JSON.parse(localStorage.getItem('twilioCallHistory') || '[]');
            console.log('DEBUG: Cargando historial de llamadas:', callHistory.length, 'llamadas');
            
            // Cargar las últimas 5 en llamadas recientes
            const recentCalls = callHistory.slice(0, 5);
            recentCalls.forEach(callData => this.addToRecentCalls(callData));
            
            // Cargar todas en el historial
            callHistory.forEach(callData => this.addToCallHistory(callData));
            
        } catch (error) {
            console.error('DEBUG: Error al cargar historial de llamadas:', error);
        }
    }

    // ========== FUNCIONES DE CONTACTOS ==========
    
    /**
     * Inicializa los event listeners para contactos
     */
    setupContactEventListeners() {
        const addContactBtn = document.getElementById('addContactBtn');
        const saveContactBtn = document.getElementById('saveContactBtn');
        const contactForm = document.getElementById('contactForm');
        const contactSearch = document.getElementById('contactSearch');
        
        if (addContactBtn) {
            addContactBtn.addEventListener('click', () => {
                this.showContactModal();
            });
        }
        
        if (saveContactBtn) {
            saveContactBtn.addEventListener('click', () => {
                this.saveContact();
            });
        }
        
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveContact();
            });
        }
        
        if (contactSearch) {
            contactSearch.addEventListener('input', (e) => {
                this.filterContacts(e.target.value);
            });
        }
    }
    
    /**
     * Muestra el modal para agregar/editar contacto
     */
    showContactModal(contact = null) {
        const modal = new bootstrap.Modal(document.getElementById('contactModal'));
        const title = document.getElementById('contactModalTitle');
        const nameInput = document.getElementById('contactName');
        const phoneInput = document.getElementById('contactPhone');
        const emailInput = document.getElementById('contactEmail');
        const companyInput = document.getElementById('contactCompany');
        
        if (contact) {
            // Modo edición
            title.innerHTML = '<i class="bx bx-edit me-2"></i>Editar Contacto';
            nameInput.value = contact.name || '';
            phoneInput.value = contact.phone || '';
            emailInput.value = contact.email || '';
            companyInput.value = contact.company || '';
            
            // Guardar ID para edición
            document.getElementById('contactForm').dataset.editId = contact.id;
        } else {
            // Modo agregar
            title.innerHTML = '<i class="bx bx-user-plus me-2"></i>Agregar Contacto';
            nameInput.value = '';
            phoneInput.value = '';
            emailInput.value = '';
            companyInput.value = '';
            
            // Limpiar ID de edición
            delete document.getElementById('contactForm').dataset.editId;
        }
        
        modal.show();
    }
    
    /**
     * Guarda un contacto
     */
    saveContact() {
        const nameInput = document.getElementById('contactName');
        const phoneInput = document.getElementById('contactPhone');
        const emailInput = document.getElementById('contactEmail');
        const companyInput = document.getElementById('contactCompany');
        const form = document.getElementById('contactForm');
        
        // Validar campos requeridos
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            this.showError('Nombre y teléfono son campos requeridos');
            return;
        }
        
        // Limpiar y validar número de teléfono
        const cleanPhone = phoneInput.value.replace(/[^+\d]/g, '');
        if (!cleanPhone.startsWith('+')) {
            this.showError('El número debe incluir código de país (+)');
            return;
        }
        
        const contact = {
            id: form.dataset.editId || Date.now().toString(),
            name: nameInput.value.trim(),
            phone: cleanPhone,
            email: emailInput.value.trim(),
            company: companyInput.value.trim(),
            createdAt: form.dataset.editId ? undefined : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        try {
            let contacts = this.getContacts();
            
            if (form.dataset.editId) {
                // Editar contacto existente
                const index = contacts.findIndex(c => c.id === form.dataset.editId);
                if (index !== -1) {
                    contacts[index] = { ...contacts[index], ...contact };
                }
            } else {
                // Agregar nuevo contacto
                contacts.push(contact);
            }
            
            // Guardar en localStorage
            localStorage.setItem('twilioContacts', JSON.stringify(contacts));
            
            // Actualizar lista
            this.loadContacts();
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('contactModal'));
            modal.hide();
            
            this.showSuccess(form.dataset.editId ? 'Contacto actualizado' : 'Contacto guardado');
            
        } catch (error) {
            console.error('Error guardando contacto:', error);
            this.showError('Error al guardar el contacto');
        }
    }
    
    /**
     * Obtiene la lista de contactos del localStorage
     */
    getContacts() {
        try {
            const contacts = localStorage.getItem('twilioContacts');
            return contacts ? JSON.parse(contacts) : [];
        } catch (error) {
            console.error('Error obteniendo contactos:', error);
            return [];
        }
    }
    
    /**
     * Carga y muestra los contactos en la lista
     */
    loadContacts() {
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;
        
        const contacts = this.getContacts();
        
        if (contacts.length === 0) {
            contactsList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bx bx-user-plus bx-lg mb-2"></i>
                    <p class="mb-0">No hay contactos guardados</p>
                    <small>Agregue contactos para acceso rápido</small>
                </div>
            `;
            return;
        }
        
        contactsList.innerHTML = contacts.map(contact => this.createContactElement(contact)).join('');
        
        // Agregar event listeners para los botones de acción
        this.setupContactActionListeners();
    }
    
    /**
     * Crea el elemento HTML para un contacto
     */
    createContactElement(contact) {
        const initials = contact.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        return `
            <div class="d-flex align-items-center justify-content-between p-3 border-bottom contact-item" data-contact-id="${contact.id}">
                <div class="d-flex align-items-center">
                    <div class="avatar avatar-sm me-3">
                        <span class="avatar-initial rounded-circle bg-label-primary">${initials}</span>
                    </div>
                    <div>
                        <h6 class="mb-0">${contact.name}</h6>
                        <small class="text-muted">${contact.phone}</small>
                        ${contact.company ? `<br><small class="text-muted">${contact.company}</small>` : ''}
                    </div>
                </div>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-success call-contact-btn" data-phone="${contact.phone}" data-contact-name="${contact.name}" title="Llamar">
                        <i class="bx bx-phone"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary edit-contact-btn" data-contact-id="${contact.id}" title="Editar">
                        <i class="bx bx-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-contact-btn" data-contact-id="${contact.id}" title="Eliminar">
                        <i class="bx bx-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Configura los event listeners para las acciones de contactos
     */
    setupContactActionListeners() {
        // Botones de llamar
        document.querySelectorAll('.call-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const phone = btn.dataset.phone;
                const contactName = btn.dataset.contactName || 'Contacto';
                
                // Llenar el campo de número
                const phoneNumberInput = document.getElementById('phoneNumber');
                if (phoneNumberInput) {
                    phoneNumberInput.value = phone;
                }
                
                // Cambiar a la pestaña de llamadas
                const callTab = document.querySelector('[data-bs-target="#navs-pills-call"]');
                if (callTab) {
                    const tab = new bootstrap.Tab(callTab);
                    tab.show();
                    
                    // Esperar un momento para que la pestaña se active y luego iniciar la llamada
                    setTimeout(() => {
                        this.makeCall(phone);
                        this.showSuccess(`Llamando a ${contactName}...`);
                    }, 300);
                } else {
                    // Si no se puede cambiar de pestaña, llamar directamente
                    this.makeCall(phone);
                    this.showSuccess(`Llamando a ${contactName}...`);
                }
            });
        });
        
        // Botones de editar
        document.querySelectorAll('.edit-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const contactId = btn.dataset.contactId;
                const contact = this.getContacts().find(c => c.id === contactId);
                if (contact) {
                    this.showContactModal(contact);
                }
            });
        });
        
        // Botones de eliminar
        document.querySelectorAll('.delete-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const contactId = btn.dataset.contactId;
                this.deleteContact(contactId);
            });
        });
    }
    
    /**
     * Elimina un contacto
     */
    deleteContact(contactId) {
        const contact = this.getContacts().find(c => c.id === contactId);
        if (!contact) return;
        
        // Confirmar eliminación
        if (confirm(`¿Está seguro de eliminar el contacto "${contact.name}"?`)) {
            try {
                let contacts = this.getContacts();
                contacts = contacts.filter(c => c.id !== contactId);
                localStorage.setItem('twilioContacts', JSON.stringify(contacts));
                this.loadContacts();
                this.showSuccess('Contacto eliminado');
            } catch (error) {
                console.error('Error eliminando contacto:', error);
                this.showError('Error al eliminar el contacto');
            }
        }
    }
    
    /**
     * Filtra contactos por nombre o teléfono
     */
    filterContacts(searchTerm) {
        const contactItems = document.querySelectorAll('.contact-item');
        const term = searchTerm.toLowerCase();
        
        contactItems.forEach(item => {
            const contactId = item.dataset.contactId;
            const contact = this.getContacts().find(c => c.id === contactId);
            
            if (contact) {
                const matchesName = contact.name.toLowerCase().includes(term);
                const matchesPhone = contact.phone.includes(term);
                const matchesCompany = contact.company && contact.company.toLowerCase().includes(term);
                
                if (matchesName || matchesPhone || matchesCompany || term === '') {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    }
}

// Crear instancia global
window.twilioPhone = new TwilioPhone();