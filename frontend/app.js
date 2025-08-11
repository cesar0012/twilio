/**
 * TwilioCall - Aplicación VoIP Moderna
 * Controlador principal de la aplicación
 */

class TwilioCallApp {
    constructor() {
        this.device = null;
        this.currentCall = null;
        this.isConnected = false;
        this.callTimer = null;
        this.callStartTime = null;
        
        // Managers
        this.credentialsManager = null;
        this.contactManager = null;
        this.historyManager = null;
        this.phoneManager = null;
        
        // UI Elements
        this.elements = {
            // Connection elements
            connectionStatus: document.getElementById('connectionStatus'),
            settingsBtn: document.getElementById('settingsBtn'),
            statusDot: document.querySelector('.status-dot'),
            
            // Dialer elements
            phoneInput: document.getElementById('phoneNumberInput'),
            clearBtn: document.getElementById('clearNumberBtn'),
            dialpadGrid: document.getElementById('dialpadGrid'),
            dialpadBtns: document.querySelectorAll('.dialpad-btn'),
            makeCallBtn: document.getElementById('makeCallBtn'),
            callBtn: document.getElementById('callBtn'),
            recentCallsList: document.getElementById('recentCallsList'),
            
            // Call overlay
            callOverlay: document.getElementById('callOverlay'),
            callStatus: document.getElementById('callStatus'),
            callNumber: document.getElementById('callNumber'),
            callTimer: document.getElementById('callTimer'),
            muteBtn: document.getElementById('muteBtn'),
            holdBtn: document.getElementById('holdBtn'),
            hangupBtn: document.getElementById('hangupBtn'),
            speakerBtn: document.getElementById('speakerBtn'),
            
            // Incoming call modal
            incomingCallModal: document.getElementById('incomingCallModal'),
            incomingCallerNumber: document.getElementById('incomingCallerNumber'),
            acceptCallBtn: document.getElementById('acceptCallBtn'),
            rejectCallBtn: document.getElementById('rejectCallBtn'),
            
            // Settings
            credentialsForm: document.getElementById('credentials-form'),
            connectBtn: document.getElementById('connect-button'),
            disconnectBtn: document.getElementById('disconnect-button'),
            clearCredentialsBtn: document.getElementById('clear-credentials'),
            statusMessages: document.getElementById('status-messages'),
            
            // Contacts
            contactsList: document.getElementById('contactsList'),
            addContactBtn: document.getElementById('addContactBtn'),
            contactForm: document.getElementById('contactForm'),
            contactFormElement: document.getElementById('contactFormElement'),
            cancelContactBtn: document.getElementById('cancelContactBtn'),
            contactSearch: document.getElementById('contactSearch'),
            
            // History
            historyList: document.getElementById('historyList'),
            historyFilter: document.getElementById('historyFilter'),
            
            // Tab elements
            tabBtns: document.querySelectorAll('.nav-link'),
            tabContents: document.querySelectorAll('.tab-pane'),
            
            // Notifications
            notificationContainer: document.getElementById('notificationContainer')
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize managers
            this.credentialsManager = new CredentialsManager();
            this.contactManager = new ContactManager(this);
            this.historyManager = new CallHistoryManager(this);
            this.phoneManager = new PhoneManager(this);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load saved data
            await this.loadSavedData();
            
            // Update UI
            this.updateConnectionStatus('disconnected');
            
            // Load initial data
            this.loadInitialData();
            
            console.log('TwilioCall App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showNotification('Error al inicializar la aplicación', 'error');
        }
    }
    
    setupEventListeners() {
        // Dialer events
        if (this.elements.dialpadGrid) {
            this.elements.dialpadGrid.addEventListener('click', (e) => {
                if (e.target.closest('.dialpad-btn')) {
                    const digit = e.target.closest('.dialpad-btn').dataset.digit;
                    this.addDigit(digit);
                    
                    // Si hay una llamada activa, enviar tono DTMF
                    if (this.phoneManager && this.phoneManager.currentCall) {
                        this.phoneManager.sendDTMF(digit);
                        this.showNotification(`Tono enviado: ${digit}`, 'info');
                    }
                }
            });
        }
        
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => {
                this.clearNumber();
            });
        }
        
        if (this.elements.makeCallBtn) {
            this.elements.makeCallBtn.addEventListener('click', () => {
                this.makeCall();
            });
        }
        
        if (this.elements.phoneInput) {
            this.elements.phoneInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.makeCall();
                }
            });
        }
        
        // Call control events
        if (this.elements.hangupBtn) {
            this.elements.hangupBtn.addEventListener('click', () => {
                this.hangupCall();
            });
        }
        
        if (this.elements.muteBtn) {
            this.elements.muteBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }
        
        if (this.elements.holdBtn) {
            this.elements.holdBtn.addEventListener('click', () => {
                this.toggleHold();
            });
        }
        
        if (this.elements.speakerBtn) {
            this.elements.speakerBtn.addEventListener('click', () => {
                this.toggleSpeaker();
            });
        }
        
        // Incoming call events
        if (this.elements.acceptCallBtn) {
            this.elements.acceptCallBtn.addEventListener('click', () => {
                this.acceptCall();
            });
        }
        
        if (this.elements.rejectCallBtn) {
            this.elements.rejectCallBtn.addEventListener('click', () => {
                this.rejectCall();
            });
        }
        
        // Settings events
        if (this.elements.credentialsForm) {
            this.elements.credentialsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCredentials();
            });
        }
        
        if (this.elements.connectBtn) {
            this.elements.connectBtn.addEventListener('click', () => {
                this.connect();
            });
        }
        
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.addEventListener('click', () => {
                this.disconnect();
            });
        }
        
        if (this.elements.clearCredentialsBtn) {
            this.elements.clearCredentialsBtn.addEventListener('click', () => {
                this.clearCredentials();
            });
        }
        
        // Contact events
        if (this.elements.addContactBtn) {
            this.elements.addContactBtn.addEventListener('click', () => {
                this.showContactForm();
            });
        }
        
        if (this.elements.cancelContactBtn) {
            this.elements.cancelContactBtn.addEventListener('click', () => {
                this.hideContactForm();
            });
        }
        
        if (this.elements.contactFormElement) {
            this.elements.contactFormElement.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveContact();
            });
        }
        
        if (this.elements.contactSearch) {
            this.elements.contactSearch.addEventListener('input', (e) => {
                this.filterContacts(e.target.value);
            });
        }
        
        // History events
        if (this.elements.historyFilter) {
            this.elements.historyFilter.addEventListener('change', (e) => {
                this.filterHistory(e.target.value);
            });
        }
    }
    
    async loadSavedData() {
        // Load credentials
        const credentials = this.credentialsManager.getCredentials();
        if (credentials) {
            this.populateCredentialsForm(credentials);
        }
        
        // Load contacts
        this.contactManager.loadContacts();
        
        // Load history
        this.historyManager.loadHistory();
    }
    
    // Dialer methods
    addDigit(digit) {
        if (this.elements.phoneInput) {
            const currentValue = this.elements.phoneInput.value;
            this.elements.phoneInput.value = currentValue + digit;
            
            // Add haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }
    
    clearNumber() {
        if (this.elements.phoneInput) {
            this.elements.phoneInput.value = '';
        }
    }
    
    async makeCall() {
        let phoneNumber = this.elements.phoneInput?.value?.trim();
        
        if (!phoneNumber) {
            this.showNotification('Ingrese un número de teléfono', 'warning');
            return;
        }
        
        // Asegurar que el número tenga el signo '+' al inicio
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
        }
        
        if (this.phoneManager) {
            return await this.phoneManager.makeCall(phoneNumber);
        } else {
            this.showNotification('Sistema de llamadas no inicializado', 'error');
            return false;
        }
    }
    
    hangupCall() {
        if (this.phoneManager) {
            this.phoneManager.hangupCall();
        }
    }
    
    acceptCall() {
        if (this.phoneManager) {
            this.phoneManager.acceptCall();
        }
    }
    
    rejectCall() {
        if (this.phoneManager) {
            this.phoneManager.rejectCall();
        }
    }
    
    toggleMute() {
        if (this.phoneManager) {
            this.phoneManager.toggleMute();
        }
    }
    
    toggleHold() {
        // Implementar funcionalidad de hold
        console.log('Hold functionality not implemented yet');
    }
    
    toggleSpeaker() {
        // Implementar funcionalidad de altavoz
        console.log('Speaker functionality not implemented yet');
    }
    
    // UI Methods
    updateConnectionStatus(status) {
        if (!this.elements.connectionStatus) return;
        
        this.elements.connectionStatus.className = `connection-status ${status}`;
        
        const statusTexts = {
            disconnected: 'Desconectado',
            connecting: 'Conectando...',
            connected: 'Conectado',
            calling: 'Llamando...'
        };
        
        this.elements.connectionStatus.innerHTML = `
            <div class="status-dot"></div>
            <span>${statusTexts[status] || status}</span>
        `;
        
        // Update button states
        if (this.elements.connectBtn) {
            this.elements.connectBtn.disabled = status === 'connected' || status === 'connecting';
        }
        
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.disabled = status === 'disconnected';
        }
        
        if (this.elements.makeCallBtn) {
            this.elements.makeCallBtn.disabled = status !== 'connected';
        }
    }
    
    showCallOverlay(number, status) {
        if (this.elements.callOverlay) {
            this.elements.callOverlay.style.display = 'flex';
            
            if (this.elements.callNumber) {
                this.elements.callNumber.textContent = number;
            }
            
            if (this.elements.callStatus) {
                this.elements.callStatus.textContent = status;
            }
            
            this.startCallTimer();
        }
    }
    
    hideCallOverlay() {
        if (this.elements.callOverlay) {
            this.elements.callOverlay.style.display = 'none';
        }
        this.stopCallTimer();
    }
    
    showIncomingCallModal(number) {
        if (this.elements.incomingCallModal && this.elements.incomingCallerNumber) {
            this.elements.incomingCallerNumber.textContent = number;
            
            // Use Bootstrap modal if available
            if (window.bootstrap) {
                const modal = new bootstrap.Modal(this.elements.incomingCallModal);
                modal.show();
            } else {
                this.elements.incomingCallModal.style.display = 'block';
            }
        }
    }
    
    hideIncomingCallModal() {
        if (this.elements.incomingCallModal) {
            // Use Bootstrap modal if available
            if (window.bootstrap) {
                const modal = bootstrap.Modal.getInstance(this.elements.incomingCallModal);
                if (modal) modal.hide();
            } else {
                this.elements.incomingCallModal.style.display = 'none';
            }
        }
    }
    
    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            if (this.elements.callTimer) {
                this.elements.callTimer.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }
    
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
    
    // Data loading methods
    loadInitialData() {
        // Load recent calls
        this.renderRecentCalls();
        
        // Load contacts
        this.renderContacts();
        
        // Load history
        this.renderHistory();
    }
    
    // Placeholder methods for managers
    renderRecentCalls() {
        if (this.historyManager) {
            const recentCalls = this.historyManager.getRecentCalls(5);
            this.renderRecentCallsList(recentCalls);
        }
    }
    
    renderContacts() {
        if (this.contactManager) {
            this.contactManager.renderContacts();
        }
    }
    
    renderHistory() {
        if (this.historyManager) {
            this.historyManager.renderHistory();
        }
    }
    
    renderRecentCallsList(calls) {
        const recentCallsList = this.elements.recentCallsList;
        if (!recentCallsList || !calls || calls.length === 0) {
            if (recentCallsList) {
                recentCallsList.innerHTML = '<p class="text-muted text-center">No hay llamadas recientes</p>';
            }
            return;
        }
        
        const callsHTML = calls.map(call => {
            const displayName = call.contactName || call.number;
            const timeString = new Date(call.timestamp).toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="recent-call-item" onclick="twilioApp.callNumber('${call.number}')">
                    <div class="recent-call-info">
                        <div class="recent-call-name">${displayName}</div>
                        <div class="recent-call-time">${timeString}</div>
                    </div>
                    <i class="fas fa-phone text-success"></i>
                </div>
            `;
        }).join('');
        
        recentCallsList.innerHTML = callsHTML;
    }
    
    callNumber(phoneNumber) {
        if (this.elements.phoneInput) {
            this.elements.phoneInput.value = phoneNumber;
            this.makeCall();
        }
    }
    
    showContactForm() {
        if (this.elements.contactForm) {
            this.elements.contactForm.style.display = 'block';
        }
    }
    
    hideContactForm() {
        if (this.elements.contactForm) {
            this.elements.contactForm.style.display = 'none';
        }
    }
    
    saveContact() {
        if (this.contactManager) {
            this.contactManager.saveContactFromForm();
        }
    }
    
    filterContacts(query) {
        if (this.contactManager) {
            this.contactManager.searchContacts(query);
        }
    }
    
    filterHistory(filter) {
        if (this.historyManager) {
            this.historyManager.filterHistory(filter);
        }
    }
    
    populateCredentialsForm(credentials) {
        // Will be implemented with CredentialsManager
        console.log('Populating credentials form...');
    }
    
    saveCredentials() {
        // Will be implemented with CredentialsManager
        console.log('Saving credentials...');
    }
    
    clearCredentials() {
        // Will be implemented with CredentialsManager
        console.log('Clearing credentials...');
    }
    
    async connect() {
        if (this.phoneManager) {
            return await this.phoneManager.connect();
        }
        return false;
    }
    
    async disconnect() {
        if (this.phoneManager) {
            return await this.phoneManager.disconnect();
        }
        return false;
    }
    
    setupCallEventListeners(call) {
        // Will be implemented with Twilio Call events
        console.log('Setting up call event listeners...');
    }
}

// Funciones globales para el HTML
async function toggleConnection() {
    const toggle = document.getElementById('connectionToggle');
    const label = document.getElementById('toggleLabel');
    
    if (toggle.checked) {
        const success = await twilioApp.connect();
        if (success) {
            if (label) label.textContent = 'Desconectar';
        } else {
            // Si falla la conexión, revertir el toggle
            toggle.checked = false;
            if (label) label.textContent = 'Conectar';
        }
    } else {
        await twilioApp.disconnect();
        if (label) label.textContent = 'Conectar';
    }
}

function saveCredentials() {
    const accountSid = document.getElementById('accountSid').value.trim();
    const authToken = document.getElementById('authToken').value.trim();
    const apiKeySid = document.getElementById('apiKeySid').value.trim();
    const apiKeySecret = document.getElementById('apiKeySecret').value.trim();
    const twimlAppSid = document.getElementById('twimlAppSid').value.trim();
    const twilioPhoneNumber = document.getElementById('twilioPhoneNumber').value.trim();
    
    if (!accountSid || !authToken || !apiKeySid || !apiKeySecret || !twimlAppSid || !twilioPhoneNumber) {
        twilioApp.showNotification('Por favor, completa todos los campos de credenciales', 'error');
        return;
    }
    
    const credentials = {
        accountSid,
        authToken,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        twilioPhoneNumber
    };
    
    const success = twilioApp.credentialsManager.saveCredentials(credentials);
    if (success) {
        twilioApp.showNotification('Credenciales guardadas correctamente', 'success');
        
        // Habilitar el toggle de conexión
        const connectionToggle = document.getElementById('connectionToggle');
        if (connectionToggle) {
            connectionToggle.disabled = false;
        }
    } else {
        twilioApp.showNotification('Error al guardar las credenciales', 'error');
    }
}

function confirmClearCredentials() {
    Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Quieres limpiar todas las credenciales? Esta acción no se puede deshacer.',
        icon: 'warning',
        iconColor: '#ffab00',
        showCancelButton: true,
        confirmButtonColor: '#ff3e1d',
        cancelButtonColor: '#032cc5',
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'swal-custom'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            twilioApp.credentialsManager.clearCredentials();
            // Limpiar los campos del formulario
            document.getElementById('accountSid').value = '';
            document.getElementById('authToken').value = '';
            document.getElementById('apiKeySid').value = '';
            document.getElementById('apiKeySecret').value = '';
            document.getElementById('twimlAppSid').value = '';
            document.getElementById('twilioPhoneNumber').value = '';
            
            // Limpiar el campo identity si existe (para compatibilidad)
            const identityField = document.getElementById('identity');
            if (identityField) {
                identityField.value = '';
            }
            
            // Deshabilitar el toggle de conexión
            const connectionToggle = document.getElementById('connectionToggle');
            if (connectionToggle) {
                connectionToggle.disabled = true;
                connectionToggle.checked = false;
            }
            
            // Mostrar notificación
            twilioApp.showNotification('Credenciales limpiadas correctamente', 'success');
            
            // Desconectar si está conectado
            if (twilioApp.phoneManager && twilioApp.phoneManager.device) {
                twilioApp.disconnect();
            }
        }
    });
}

// Classes are now loaded from separate files:
// - CredentialsManager from credentials.js
// - ContactManager from contact-manager.js
// - CallHistoryManager from history-manager.js
// - PhoneManager from phone.js

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.twilioApp = new TwilioCallApp();
});