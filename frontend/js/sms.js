/**
 * Módulo para el manejo de SMS con Twilio
 * Gestiona el envío y recepción de mensajes SMS
 */

class TwilioSMS {
    constructor() {
        this.backendUrl = 'https://twilio.neox.site'; // URL del backend Flask en VPS
        this.smsList = [];
        this.currentChat = null;
        this.pollingInterval = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.loadConversations = this.loadConversations.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.fetchMessages = this.fetchMessages.bind(this);
        this.startPolling = this.startPolling.bind(this);
        this.stopPolling = this.stopPolling.bind(this);
    }

    /**
     * Inicializa el módulo de SMS
     */
    async init() {
        try {
            console.log('Inicializando módulo de SMS...');
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Solo cargar conversaciones si hay credenciales válidas
            const credentials = window.twilioCredentials?.getForBackend();
            if (credentials) {
                await this.loadConversations();
                // Iniciar polling para nuevos mensajes solo si hay credenciales
                this.startPolling();
            } else {
                console.log('No hay credenciales disponibles. Las conversaciones se cargarán después de la autenticación.');
            }
            
            console.log('Módulo de SMS inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando módulo de SMS:', error);
            this.showError('Error inicializando el módulo de SMS');
        }
    }

    /**
     * Configura los event listeners
     */
    setupEventListeners() {
        // Botón de nuevo SMS
        const newSmsBtn = document.getElementById('newSmsBtn');
        if (newSmsBtn) {
            newSmsBtn.addEventListener('click', () => {
                this.showNewSmsModal();
            });
        }
        
        // Botón de enviar SMS
        const sendSmsBtn = document.getElementById('sendSmsBtn');
        if (sendSmsBtn) {
            sendSmsBtn.addEventListener('click', () => {
                this.handleSendMessage();
            });
        }
        
        // Enter key en input de mensaje
        const smsMessageText = document.getElementById('smsMessageText');
        if (smsMessageText) {
            smsMessageText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendMessage();
                }
            });
        }
        
        // Búsqueda de conversaciones
        const smsSearch = document.getElementById('smsSearch');
        if (smsSearch) {
            smsSearch.addEventListener('input', (e) => {
                this.filterConversations(e.target.value);
            });
        }
        
        // Event delegation para clics en conversaciones
        const smsList = document.getElementById('smsList');
        if (smsList) {
            smsList.addEventListener('click', (e) => {
                const conversationItem = e.target.closest('.conversation-item');
                if (conversationItem) {
                    const contactNumber = conversationItem.dataset.contact;
                    if (contactNumber) {
                        this.fetchMessages(contactNumber);
                        // Marcar como seleccionada
                        document.querySelectorAll('.conversation-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        conversationItem.classList.add('active');
                    }
                }
            });
        }
        
        // Actualizar estado de conexión cuando cambia la conexión de Twilio
        if (window.twilioPhone) {
            // Escuchar eventos de conexión de Twilio
            const originalUpdateStatus = window.twilioPhone.updateStatus;
            window.twilioPhone.updateStatus = (message, status) => {
                originalUpdateStatus.call(window.twilioPhone, message, status);
                // Actualizar estado de SMS también
                this.updateSmsStatus(status);
            };
        }
    }

    /**
     * Carga las conversaciones existentes
     */
    async loadConversations() {
        try {
            // Obtener credenciales completas (incluyendo Auth Token para SMS)
            const credentials = window.twilioCredentials.load();
            if (!credentials) {
                console.warn('No hay credenciales disponibles para cargar conversaciones');
                return;
            }
            
            // Obtener el número de Twilio del usuario
            const userNumbers = await this.getUserPhoneNumbers(credentials);
            if (userNumbers.length === 0) {
                console.warn('No se encontraron números de teléfono del usuario');
                return;
            }
            
            const userNumber = userNumbers[0].phoneNumber; // Usar el primer número disponible
            console.log(`[SMS] Cargando conversaciones para usuario: ${userNumber}`);
            
            // Obtener conversaciones del backend
            const response = await fetch(`${this.backendUrl}/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accountSid: credentials.accountSid,
                    authToken: credentials.authToken,
                    userNumber: userNumber  // Agregar número del usuario para filtrado
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error obteniendo conversaciones');
            }
            
            const data = await response.json();
            console.log('Conversaciones obtenidas:', data);
            
            // Actualizar la UI con las conversaciones
            this.updateConversationsList(data.conversations || []);
            
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
            this.showError('Error cargando conversaciones: ' + error.message);
        }
    }

    /**
     * Obtiene los números de teléfono del usuario desde Twilio
     */
    async getUserPhoneNumbers(credentials) {
        try {
            const response = await fetch(`${this.backendUrl}/phone-numbers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            if (!response.ok) {
                throw new Error('Error obteniendo números de teléfono');
            }
            
            const data = await response.json();
            return data.phoneNumbers || [];
        } catch (error) {
            console.error('Error obteniendo números de teléfono:', error);
            throw error;
        }
    }

    /**
     * Actualiza la lista de conversaciones en la UI
     */
    updateConversationsList(conversations) {
        const smsListElement = document.getElementById('smsList');
        if (!smsListElement) return;
        
        if (conversations.length === 0) {
            smsListElement.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bx bx-message bx-lg mb-2"></i>
                    <p class="mb-0">No hay conversaciones</p>
                    <small>Envíe un mensaje para iniciar una conversación</small>
                </div>
            `;
            return;
        }
        
        // En una implementación completa, aquí se renderizarían las conversaciones
        let html = '';
        conversations.forEach(conv => {
            html += this.createConversationElement(conv);
        });
        
        smsListElement.innerHTML = html;
    }

    /**
     * Crea un elemento HTML para una conversación
     */
    createConversationElement(conversation) {
        const lastMessage = conversation.last_message_body || 'Sin mensajes';
        const messageCount = conversation.message_count || 0;
        const lastMessageTime = conversation.last_message_date ? 
            new Date(conversation.last_message_date).toLocaleDateString() : '';
        
        return `
            <div class="d-flex align-items-center p-3 border-bottom conversation-item" 
                 data-contact="${conversation.contact}" 
                 style="cursor: pointer;">
                <div class="flex-shrink-0 me-3">
                    <div class="avatar avatar-sm">
                        <span class="avatar-initial rounded-circle bg-label-primary">
                            <i class="bx bx-user"></i>
                        </span>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-0">${conversation.contact}</h6>
                    <small class="text-muted d-block" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${lastMessage}
                    </small>
                    ${lastMessageTime ? `<small class="text-muted">${lastMessageTime}</small>` : ''}
                </div>
                <div class="flex-shrink-0">
                    <span class="badge bg-primary rounded-pill">${messageCount}</span>
                </div>
            </div>
        `;
    }

    /**
     * Muestra el modal para nuevo SMS
     */
    showNewSmsModal() {
        // En una implementación completa, aquí se mostraría un modal para crear un nuevo SMS
        // Por ahora, simplemente mostramos una alerta
        if (window.Swal) {
            Swal.fire({
                title: 'Nuevo mensaje',
                html: `
                    <div class="mb-3">
                        <label for="newSmsNumber" class="form-label">Número de teléfono</label>
                        <input type="tel" class="form-control" id="newSmsNumber" placeholder="+1234567890">
                    </div>
                    <div class="mb-3">
                        <label for="newSmsMessage" class="form-label">Mensaje</label>
                        <textarea class="form-control" id="newSmsMessage" rows="3" placeholder="Escriba su mensaje"></textarea>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Enviar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const number = document.getElementById('newSmsNumber').value;
                    const message = document.getElementById('newSmsMessage').value;
                    
                    if (!number || !message) {
                        Swal.showValidationMessage('Por favor complete todos los campos');
                        return false;
                    }
                    
                    return { number, message };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    this.sendNewMessage(result.value.number, result.value.message);
                }
            });
        } else {
            // Fallback si SweetAlert2 no está disponible
            const number = prompt('Ingrese el número de teléfono:');
            const message = prompt('Ingrese el mensaje:');
            
            if (number && message) {
                this.sendNewMessage(number, message);
            }
        }
    }

    /**
     * Envía un nuevo mensaje
     */
    async sendNewMessage(to, message) {
        try {
            await this.sendMessage(to, message);
            this.showSuccess('Mensaje enviado correctamente');
            
            // Actualizar la lista de conversaciones
            await this.loadConversations();
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            this.showError('Error enviando mensaje: ' + error.message);
        }
    }

    /**
     * Maneja el envío de un mensaje desde el input
     */
    async handleSendMessage() {
        const messageInput = document.getElementById('smsMessageText');
        if (!messageInput || !this.currentChat) return;
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        try {
            await this.sendMessage(this.currentChat, message);
            messageInput.value = '';
            
            // Actualizar la vista de mensajes
            await this.fetchMessages(this.currentChat);
            
            // Actualizar la lista de conversaciones para reflejar el último mensaje
            await this.loadConversations();
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            this.showError('Error enviando mensaje: ' + error.message);
        }
    }

    /**
     * Muestra los números de prueba disponibles para Twilio
     */
    showTestNumbers() {
        const testNumbers = [
            { number: '+15005550006', description: '✅ Número válido (recomendado para pruebas)' },
            { number: '+15005550001', description: '❌ Número inválido (prueba manejo de errores)' },
            { number: '+15005550002', description: '🚫 No enrutable (prueba errores de red)' },
            { number: '+15005550003', description: '🌍 Sin permisos internacionales' },
            { number: '+15005550004', description: '🔒 Número bloqueado' },
            { number: '+15005550009', description: '📵 Incapaz de recibir SMS' }
        ];
        
        let message = '📱 **NÚMEROS DE PRUEBA TWILIO DISPONIBLES:**\n\n';
        testNumbers.forEach(item => {
            message += `${item.number}\n${item.description}\n\n`;
        });
        message += '💡 **Recomendación:** Use +15005550006 para pruebas exitosas';
        
        Swal.fire({
            title: 'Números de Prueba Twilio',
            html: message.replace(/\n/g, '<br>'),
            icon: 'info',
            confirmButtonText: 'Entendido',
            width: '600px'
        });
    }

    /**
     * Valida el número de teléfono de destino
     */
    validatePhoneNumber(phoneNumber) {
        // Remover espacios y caracteres especiales
        const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // Verificar formato internacional
        if (!cleanNumber.startsWith('+')) {
            throw new Error('El número debe incluir el código de país (ej: +52 para México, +1 para USA)');
        }
        
        // Extraer código de país
        const countryCode = cleanNumber.substring(1, 3);
        
        // Números mágicos de Twilio para pruebas (solo con credenciales de prueba)
        const twilioMagicNumbers = {
            // Números válidos para pruebas
            '+15005550006': 'Número de prueba válido (pasa todas las validaciones)',
            // Números que generan errores específicos para pruebas
            '+15005550001': 'Número inválido (para probar manejo de errores)',
            '+15005550002': 'Número no enrutable (para probar errores de red)',
            '+15005550003': 'Sin permisos internacionales (para probar restricciones)',
            '+15005550004': 'Número bloqueado (para probar bloqueos)',
            '+15005550009': 'Incapaz de recibir SMS (para probar capacidades)'
        };
        
        // Verificar si es un número mágico de Twilio
        if (twilioMagicNumbers[cleanNumber]) {
            console.log(`[PRUEBA] Usando número mágico de Twilio: ${twilioMagicNumbers[cleanNumber]}`);
            return cleanNumber;
        }
        
        // Lista de códigos de país comúnmente soportados por Twilio
        const supportedCountries = {
            '1': 'Estados Unidos/Canadá',
            '44': 'Reino Unido',
            '49': 'Alemania',
            '33': 'Francia',
            '34': 'España',
            '39': 'Italia',
            '61': 'Australia',
            '81': 'Japón'
        };
        
        // Validar formato de número (mínimo 10 dígitos después del código de país)
        if (cleanNumber.length < 12) {
            throw new Error('El número de teléfono debe tener al menos 10 dígitos después del código de país.');
        }
        
        // Rechazar números 555 que no sean números mágicos de Twilio
        if (cleanNumber.includes('555') && !twilioMagicNumbers[cleanNumber]) {
            throw new Error('Los números 555 no son válidos para SMS reales. Use números mágicos de Twilio para pruebas: +15005550006 (válido) o números reales para producción.');
        }
        
        // Advertencia para México y otros países que pueden requerir configuración especial
        if (countryCode === '52') {
            throw new Error('CONFIGURACIÓN REQUERIDA: Para enviar SMS a México (+52), debe habilitar permisos geográficos en su cuenta Twilio. Vaya a Console > Messaging > Settings > Geo Permissions y habilite México.');
        }
        
        return cleanNumber;
    }

    /**
     * Envía un mensaje SMS
     */
    async sendMessage(to, message) {
        try {
            // Verificar que estemos conectados
            if (!window.twilioPhone || !window.twilioPhone.isConnected) {
                throw new Error('No hay conexión a Twilio. Por favor, conéctese primero.');
            }
            
            // Validar número de destino
            const validatedNumber = this.validatePhoneNumber(to);
            
            // Obtener credenciales completas (incluyendo Auth Token para SMS)
            const credentials = window.twilioCredentials.load();
            if (!credentials) {
                throw new Error('No hay credenciales disponibles');
            }
            
            // Obtener el número de Twilio del usuario
            const userNumbers = await this.getUserPhoneNumbers(credentials);
            if (userNumbers.length === 0) {
                throw new Error('No se encontraron números de teléfono');
            }
            
            // Filtrar números que tengan capacidad SMS
            const smsCapableNumbers = userNumbers.filter(number => 
                number.capabilities && number.capabilities.sms === true
            );
            
            if (smsCapableNumbers.length === 0) {
                throw new Error('No se encontraron números de teléfono con capacidad SMS. Verifique que sus números de Twilio tengan habilitada la funcionalidad SMS.');
            }
            
            const fromNumber = smsCapableNumbers[0].phoneNumber; // Usar el primer número con capacidad SMS
            
            // Preparar datos para el envío
            const smsData = {
                ...credentials,
                from: fromNumber,
                to: validatedNumber,
                body: message
            };
            
            // Enviar mensaje al backend
            const response = await fetch(`${this.backendUrl}/send-sms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(smsData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error enviando SMS');
            }
            
            const data = await response.json();
            console.log('Mensaje enviado:', data);
            
            // Mostrar mensaje de éxito
            this.showSuccess('Mensaje enviado correctamente');
            
            // Recargar conversaciones para mostrar la nueva conversación
            await this.loadConversations();
            
            return data;
        } catch (error) {
            console.error('Error enviando SMS:', error);
            
            // Detectar errores de números inválidos y mostrar números de prueba
            if (error.message.includes('Invalid \'To\' Phone Number') || 
                error.message.includes('Los números 555 no son válidos') ||
                error.message.includes('Unable to create record: Invalid')) {
                
                this.showError('❌ Número de teléfono inválido. Consulte los números de prueba disponibles.');
                
                // Mostrar números de prueba después de un breve delay
                setTimeout(() => {
                    this.showTestNumbers();
                }, 1500);
                
                throw error;
            }
            
            // Detectar errores específicos de permisos geográficos
            if (error.message.includes('Permission to send an SMS has not been enabled for the region')) {
                const match = error.message.match(/\+(\d{1,3})/);
                const countryCode = match ? match[1] : 'desconocido';
                
                const countryNames = {
                    '52': 'México',
                    '54': 'Argentina', 
                    '55': 'Brasil',
                    '56': 'Chile',
                    '57': 'Colombia',
                    '58': 'Venezuela',
                    '51': 'Perú',
                    '593': 'Ecuador',
                    '591': 'Bolivia',
                    '598': 'Uruguay'
                };
                
                const countryName = countryNames[countryCode] || `código +${countryCode}`;
                
                const detailedError = `CONFIGURACIÓN REQUERIDA: No tiene permisos para enviar SMS a ${countryName}.\n\n` +
                    `SOLUCIÓN:\n` +
                    `1. Vaya a su Twilio Console\n` +
                    `2. Navegue a Messaging > Settings > Geo Permissions\n` +
                    `3. Habilite ${countryName} en la lista de países permitidos\n` +
                    `4. Guarde los cambios y espere unos minutos\n\n` +
                    `Nota: Algunos países pueden requerir verificación adicional o tener restricciones especiales.`;
                
                this.showError(detailedError);
            } else {
                this.showError('Error enviando mensaje: ' + error.message);
            }
            
            throw error;
        }
    }

    /**
     * Obtiene los mensajes de una conversación
     */
    async fetchMessages(contactNumber) {
        try {
            // Verificar que estemos conectados
            if (!window.twilioPhone || !window.twilioPhone.isConnected) {
                throw new Error('No hay conexión a Twilio. Por favor, conéctese primero.');
            }
            
            // Obtener credenciales completas (incluyendo Auth Token para SMS)
            const credentials = window.twilioCredentials.load();
            if (!credentials) {
                throw new Error('No hay credenciales disponibles');
            }
            
            // Obtener el número de Twilio del usuario
            const userNumbers = await this.getUserPhoneNumbers(credentials);
            if (userNumbers.length === 0) {
                throw new Error('No se encontraron números de teléfono');
            }
            
            const userNumber = userNumbers[0].phoneNumber; // Usar el primer número disponible
            
            console.log(`[SMS] Obteniendo mensajes para contacto: ${contactNumber}, usuario: ${userNumber}`);
            
            // Preparar datos para la consulta
            const messagesData = {
                accountSid: credentials.accountSid,
                authToken: credentials.authToken,
                phoneNumber: contactNumber, // El backend espera 'phoneNumber'
                userNumber: userNumber  // Agregar número del usuario para filtrado bidireccional
            };
            
            // Obtener mensajes del backend
            const response = await fetch(`${this.backendUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messagesData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error obteniendo mensajes');
            }
            
            const data = await response.json();
            console.log(`[SMS] Mensajes obtenidos para conversación ${contactNumber}:`, data);
            
            // Actualizar la UI con los mensajes
            this.displayMessages(data.messages || []);
            
            return data.messages || [];
        } catch (error) {
            console.error('Error obteniendo mensajes:', error);
            this.showError('Error obteniendo mensajes: ' + error.message);
            throw error;
        }
    }

    /**
     * Muestra los mensajes en la UI
     */
    displayMessages(messages) {
        const messagesContainer = document.getElementById('smsMessagesContainer');
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bx bx-chat bx-lg mb-2"></i>
                    <p class="mb-0">No hay mensajes en esta conversación</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        messages.forEach(msg => {
            html += this.createMessageElement(msg);
        });
        
        messagesContainer.innerHTML = html;
        
        // Scroll al final
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Crea un elemento HTML para un mensaje
     */
    createMessageElement(message) {
        const isOutbound = message.direction === 'outbound';
        const alignment = isOutbound ? 'justify-content-end' : 'justify-content-start';
        const bgClass = isOutbound ? 'bg-primary text-white' : 'bg-light text-dark';
        const textClass = isOutbound ? 'text-white-50' : 'text-muted';
        
        // Usar timestamp o dateCreated como fallback
        const messageTime = message.timestamp || message.dateCreated;
        
        return `
            <div class="d-flex mb-3 ${alignment}">
                <div class="card ${bgClass}" style="max-width: 70%; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div class="card-body py-2 px-3">
                        <p class="mb-1">${message.body}</p>
                        <small class="${textClass}">
                            ${this.formatTimestamp(messageTime)}
                            ${isOutbound ? ' • Enviado' : ' • Recibido'}
                        </small>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Formatea un timestamp para mostrar
     */
    formatTimestamp(timestamp) {
        // Validar que el timestamp sea válido
        if (!timestamp) {
            return 'Hora no disponible';
        }
        
        const date = new Date(timestamp);
        
        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) {
            return 'Hora no disponible';
        }
        
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Filtra las conversaciones según el texto de búsqueda
     */
    filterConversations(searchTerm) {
        const conversationItems = document.querySelectorAll('.conversation-item');
        const term = searchTerm.toLowerCase();
        
        conversationItems.forEach(item => {
            const contactNumber = item.dataset.contact;
            if (contactNumber && contactNumber.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * Inicia el polling para nuevos mensajes
     */
    startPolling() {
        // Detener polling existente si hay uno
        this.stopPolling();
        
        // Iniciar nuevo polling cada 30 segundos
        this.pollingInterval = setInterval(() => {
            this.loadConversations();
        }, 30000);
    }

    /**
     * Detiene el polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
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

    /**
     * Muestra un mensaje de éxito
     */
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
     * Actualiza el estado de conexión de SMS según el estado de Twilio
     */
    updateSmsStatus(status) {
        // Actualizar indicador de estado en la interfaz de SMS
        const smsStatusIndicator = document.getElementById('smsStatusIndicator');
        if (smsStatusIndicator) {
            // Remover clases previas
            smsStatusIndicator.classList.remove('status-connected', 'status-disconnected', 'status-connecting');
            
            switch (status) {
                case 'connected':
                    smsStatusIndicator.classList.add('status-connected');
                    smsStatusIndicator.title = 'Conectado';
                    // Cargar conversaciones cuando se conecte exitosamente
                    this.loadConversations();
                    this.startPolling();
                    break;
                case 'connecting':
                    smsStatusIndicator.classList.add('status-connecting');
                    smsStatusIndicator.title = 'Conectando...';
                    break;
                case 'disconnected':
                default:
                    smsStatusIndicator.classList.add('status-disconnected');
                    smsStatusIndicator.title = 'Desconectado';
                    // Detener polling cuando se desconecte
                    this.stopPolling();
                    break;
            }
        }
        
        // Actualizar mensaje de estado en la interfaz de SMS
        const smsStatusMessage = document.getElementById('smsStatusMessage');
        if (smsStatusMessage) {
            switch (status) {
                case 'connected':
                    smsStatusMessage.textContent = 'Conectado';
                    break;
                case 'connecting':
                    smsStatusMessage.textContent = 'Conectando...';
                    break;
                case 'disconnected':
                default:
                    smsStatusMessage.textContent = 'Desconectado';
                    break;
            }
        }
    }
    
    /**
     * Limpia los recursos
     */
    destroy() {
        this.stopPolling();
    }
}

// Crear instancia global
window.twilioSMS = new TwilioSMS();