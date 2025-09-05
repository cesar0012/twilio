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
            
            // Cargar conversaciones
            await this.loadConversations();
            
            // Iniciar polling para nuevos mensajes
            this.startPolling();
            
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
            // Verificar que estemos conectados
            if (!window.twilioPhone || !window.twilioPhone.isConnected) {
                console.warn('No hay conexión a Twilio para cargar conversaciones');
                return;
            }
            
            // Obtener credenciales completas (incluyendo Auth Token para SMS)
            const credentials = window.twilioCredentials.load();
            if (!credentials) {
                console.warn('No hay credenciales disponibles para cargar conversaciones');
                return;
            }
            
            // Obtener números de teléfono del usuario
            const userNumbers = await this.getUserPhoneNumbers(credentials);
            
            // Por ahora, mostramos un mensaje de que no hay conversaciones
            // En una implementación completa, aquí se cargarían las conversaciones reales
            this.updateConversationsList([]);
            
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
            this.showError('Error cargando conversaciones');
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
        return `
            <div class="d-flex align-items-center p-3 border-bottom conversation-item" 
                 data-contact="${conversation.contactNumber}">
                <div class="flex-shrink-0 me-3">
                    <div class="avatar avatar-sm">
                        <span class="avatar-initial rounded-circle bg-label-primary">
                            <i class="bx bx-user"></i>
                        </span>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-0">${conversation.contactNumber}</h6>
                    <small class="text-muted">${conversation.lastMessage || 'Sin mensajes'}</small>
                </div>
                <div class="flex-shrink-0">
                    <span class="badge bg-primary rounded-pill">${conversation.unreadCount || 0}</span>
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
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            this.showError('Error enviando mensaje: ' + error.message);
        }
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
            
            const fromNumber = userNumbers[0]; // Usar el primer número disponible
            
            // Preparar datos para el envío
            const smsData = {
                ...credentials,
                from: fromNumber,
                to: to,
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
            
            return data;
        } catch (error) {
            console.error('Error enviando SMS:', error);
            this.showError('Error enviando mensaje: ' + error.message);
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
            
            const userNumber = userNumbers[0]; // Usar el primer número disponible
            
            // Preparar datos para la consulta
            const messagesData = {
                ...credentials,
                userNumber: userNumber,
                contactNumber: contactNumber
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
            console.log('Mensajes obtenidos:', data);
            
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
        const bgClass = isOutbound ? 'bg-primary text-white' : 'bg-light';
        
        return `
            <div class="d-flex mb-3 ${alignment}">
                <div class="card ${bgClass}" style="max-width: 70%;">
                    <div class="card-body py-2 px-3">
                        <p class="mb-1">${message.body}</p>
                        <small class="text-muted">${this.formatTimestamp(message.timestamp)}</small>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Formatea un timestamp para mostrar
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
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
                    break;
                case 'connecting':
                    smsStatusIndicator.classList.add('status-connecting');
                    smsStatusIndicator.title = 'Conectando...';
                    break;
                case 'disconnected':
                default:
                    smsStatusIndicator.classList.add('status-disconnected');
                    smsStatusIndicator.title = 'Desconectado';
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