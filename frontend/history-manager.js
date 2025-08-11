/**
 * CallHistoryManager - Gestión del historial de llamadas
 * Maneja el almacenamiento y visualización del historial de llamadas
 */

class CallHistoryManager {
    constructor(app) {
        this.app = app;
        this.storageKey = 'twilio_call_history';
        this.history = [];
        this.filteredHistory = [];
        this.maxHistoryItems = 1000; // Límite de elementos en historial
        
        this.loadHistory();
    }

    /**
     * Carga el historial desde localStorage
     */
    loadHistory() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.history = stored ? JSON.parse(stored) : [];
            this.filteredHistory = [...this.history];
            console.log(`Loaded ${this.history.length} call history items`);
        } catch (error) {
            console.error('Error loading call history:', error);
            this.history = [];
            this.filteredHistory = [];
        }
    }

    /**
     * Guarda el historial en localStorage
     */
    saveHistory() {
        try {
            // Mantener solo los últimos elementos si excede el límite
            if (this.history.length > this.maxHistoryItems) {
                this.history = this.history.slice(-this.maxHistoryItems);
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(this.history));
            console.log('Call history saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving call history:', error);
            this.app.showNotification('Error al guardar historial', 'error');
            return false;
        }
    }

    /**
     * Agrega una llamada al historial
     */
    addCall(callData) {
        try {
            const callEntry = {
                id: this.generateCallId(),
                number: callData.number,
                type: callData.type, // 'incoming', 'outgoing', 'missed'
                status: callData.status, // 'completed', 'missed', 'rejected', 'failed'
                duration: callData.duration || 0,
                timestamp: callData.timestamp || new Date(),
                contactName: this.getContactName(callData.number),
                notes: callData.notes || '',
                quality: callData.quality || null // Calidad de la llamada si está disponible
            };

            this.history.unshift(callEntry); // Agregar al inicio
            this.saveHistory();
            this.updateFilteredHistory();
            
            // Actualizar estadísticas del contacto si existe
            if (this.app.contactManager) {
                this.app.contactManager.updateCallStats(callData.number);
            }
            
            console.log('Call added to history:', callEntry);
            return callEntry;
        } catch (error) {
            console.error('Error adding call to history:', error);
            return null;
        }
    }

    /**
     * Actualiza una llamada existente en el historial
     */
    updateCall(callId, updateData) {
        try {
            const callIndex = this.history.findIndex(call => call.id === callId);
            if (callIndex === -1) {
                console.warn('Call not found in history:', callId);
                return null;
            }

            this.history[callIndex] = {
                ...this.history[callIndex],
                ...updateData,
                updatedAt: new Date()
            };

            this.saveHistory();
            this.updateFilteredHistory();
            
            console.log('Call updated in history:', this.history[callIndex]);
            return this.history[callIndex];
        } catch (error) {
            console.error('Error updating call in history:', error);
            return null;
        }
    }

    /**
     * Elimina una llamada del historial
     */
    deleteCall(callId) {
        try {
            const callIndex = this.history.findIndex(call => call.id === callId);
            if (callIndex === -1) {
                throw new Error('Llamada no encontrada');
            }

            const deletedCall = this.history.splice(callIndex, 1)[0];
            this.saveHistory();
            this.updateFilteredHistory();
            this.renderHistory();
            
            this.app.showNotification('Llamada eliminada del historial', 'info');
            console.log('Call deleted from history:', deletedCall);
            
            return true;
        } catch (error) {
            console.error('Error deleting call from history:', error);
            this.app.showNotification(error.message, 'error');
            return false;
        }
    }

    /**
     * Filtra el historial
     */
    filterHistory(filter) {
        switch (filter) {
            case 'all':
                this.filteredHistory = [...this.history];
                break;
            case 'incoming':
                this.filteredHistory = this.history.filter(call => call.type === 'incoming');
                break;
            case 'outgoing':
                this.filteredHistory = this.history.filter(call => call.type === 'outgoing');
                break;
            case 'missed':
                this.filteredHistory = this.history.filter(call => call.status === 'missed');
                break;
            case 'today':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                this.filteredHistory = this.history.filter(call => 
                    new Date(call.timestamp) >= today
                );
                break;
            case 'week':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                this.filteredHistory = this.history.filter(call => 
                    new Date(call.timestamp) >= weekAgo
                );
                break;
            case 'month':
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                this.filteredHistory = this.history.filter(call => 
                    new Date(call.timestamp) >= monthAgo
                );
                break;
            default:
                this.filteredHistory = [...this.history];
        }
        
        this.renderHistory();
        return this.filteredHistory;
    }

    /**
     * Busca en el historial
     */
    searchHistory(query) {
        if (!query || query.trim() === '') {
            this.filteredHistory = [...this.history];
        } else {
            const searchTerm = query.toLowerCase().trim();
            this.filteredHistory = this.history.filter(call => 
                call.number.includes(searchTerm) ||
                (call.contactName && call.contactName.toLowerCase().includes(searchTerm)) ||
                (call.notes && call.notes.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderHistory();
        return this.filteredHistory;
    }

    /**
     * Obtiene estadísticas del historial
     */
    getStatistics() {
        const stats = {
            total: this.history.length,
            incoming: 0,
            outgoing: 0,
            missed: 0,
            totalDuration: 0,
            averageDuration: 0,
            todayCalls: 0,
            weekCalls: 0,
            monthCalls: 0
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        this.history.forEach(call => {
            const callDate = new Date(call.timestamp);
            
            // Tipos de llamada
            if (call.type === 'incoming') stats.incoming++;
            else if (call.type === 'outgoing') stats.outgoing++;
            
            // Llamadas perdidas
            if (call.status === 'missed') stats.missed++;
            
            // Duración
            if (call.duration) {
                stats.totalDuration += call.duration;
            }
            
            // Llamadas por período
            if (callDate >= today) stats.todayCalls++;
            if (callDate >= weekAgo) stats.weekCalls++;
            if (callDate >= monthAgo) stats.monthCalls++;
        });

        // Duración promedio
        const completedCalls = this.history.filter(call => call.duration > 0);
        if (completedCalls.length > 0) {
            stats.averageDuration = stats.totalDuration / completedCalls.length;
        }

        return stats;
    }

    /**
     * Obtiene llamadas recientes
     */
    getRecentCalls(limit = 10) {
        return this.history.slice(0, limit);
    }

    /**
     * Obtiene llamadas perdidas
     */
    getMissedCalls() {
        return this.history.filter(call => call.status === 'missed');
    }

    /**
     * Renderiza el historial
     */
    renderHistory() {
        const historyList = this.app.elements.historyList;
        if (!historyList) return;

        if (this.filteredHistory.length === 0) {
            historyList.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-history fa-3x mb-3"></i>
                    <p>No hay llamadas en el historial</p>
                </div>
            `;
            return;
        }

        const historyHTML = this.filteredHistory
            .map(call => this.renderHistoryItem(call))
            .join('');

        historyList.innerHTML = historyHTML;
    }

    /**
     * Renderiza un item del historial
     */
    renderHistoryItem(call) {
        const date = new Date(call.timestamp);
        const timeString = date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dateString = date.toLocaleDateString('es-ES');
        
        const durationString = this.formatDuration(call.duration);
        const displayName = call.contactName || call.number;
        
        // Iconos según tipo y estado
        let icon = 'fas fa-phone';
        let iconClass = 'text-secondary';
        
        if (call.type === 'incoming') {
            icon = 'fas fa-phone-alt';
            iconClass = call.status === 'missed' ? 'text-danger' : 'text-success';
        } else if (call.type === 'outgoing') {
            icon = 'fas fa-phone';
            iconClass = 'text-primary';
        }
        
        const statusText = this.getStatusText(call.status);
        
        return `
            <div class="history-item" data-call-id="${call.id}">
                <div class="history-icon">
                    <i class="${icon} ${iconClass}"></i>
                </div>
                <div class="history-info">
                    <div class="history-name">${displayName}</div>
                    <div class="history-details">
                        <span class="history-number">${call.number}</span>
                        ${call.contactName ? '' : ''}
                    </div>
                    <div class="history-meta">
                        <span class="history-status">${statusText}</span>
                        ${call.duration > 0 ? `<span class="history-duration"> • ${durationString}</span>` : ''}
                    </div>
                    <div class="history-time">
                        ${timeString} • ${dateString}
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-outline-success" onclick="twilioApp.historyManager.callFromHistory('${call.id}')" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="twilioApp.historyManager.addToContacts('${call.id}')" title="Agregar a contactos">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="twilioApp.historyManager.deleteCall('${call.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Llama desde el historial
     */
    callFromHistory(callId) {
        const call = this.history.find(c => c.id === callId);
        if (call && this.app.elements.phoneInput) {
            this.app.elements.phoneInput.value = call.number;
            this.app.makeCall();
        }
    }

    /**
     * Agrega un número del historial a contactos
     */
    addToContacts(callId) {
        const call = this.history.find(c => c.id === callId);
        if (call && this.app.contactManager) {
            // Verificar si ya existe el contacto
            const existingContact = this.app.contactManager.findContactByPhone(call.number);
            if (existingContact) {
                this.app.showNotification('Este número ya está en contactos', 'info');
                return;
            }
            
            // Pre-llenar formulario de contacto
            this.app.contactManager.showAddContactForm();
            const form = this.app.elements.contactFormElement;
            if (form && form.phone) {
                form.phone.value = call.number;
                form.name.focus();
            }
        }
    }

    /**
     * Limpia el historial
     */
    clearHistory() {
        Swal.fire({
            title: '¿Estás seguro?',
            text: '¿Quieres eliminar todo el historial de llamadas?',
            icon: 'warning',
            iconColor: '#ffab00',
            showCancelButton: true,
            confirmButtonColor: '#ff3e1d',
            cancelButtonColor: '#032cc5',
            confirmButtonText: 'Sí, eliminar todo',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'swal-custom'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.history = [];
                this.filteredHistory = [];
                this.saveHistory();
                this.renderHistory();
                this.app.showNotification('Historial eliminado', 'info');
            }
        });
    }

    /**
     * Actualiza la lista filtrada
     */
    updateFilteredHistory() {
        this.filteredHistory = [...this.history];
    }

    /**
     * Obtiene el nombre del contacto para un número
     */
    getContactName(phoneNumber) {
        if (this.app.contactManager) {
            const contact = this.app.contactManager.findContactByPhone(phoneNumber);
            return contact ? contact.name : null;
        }
        return null;
    }

    /**
     * Formatea la duración de una llamada
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 1) return '0s';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    /**
     * Obtiene el texto del estado
     */
    getStatusText(status) {
        const statusTexts = {
            'completed': 'Completada',
            'missed': 'Perdida',
            'rejected': 'Rechazada',
            'failed': 'Fallida',
            'connecting': 'Conectando',
            'ringing': 'Timbrando'
        };
        
        return statusTexts[status] || status;
    }

    /**
     * Genera un ID único para llamada
     */
    generateCallId() {
        return 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Exporta el historial
     */
    exportHistory() {
        const dataStr = JSON.stringify(this.history, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `twilio_call_history_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    /**
     * Importa historial
     */
    importHistory(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedHistory = JSON.parse(e.target.result);
                let addedCount = 0;
                
                importedHistory.forEach(call => {
                    // Verificar que no exista ya (por timestamp y número)
                    const exists = this.history.some(existingCall => 
                        existingCall.timestamp === call.timestamp && 
                        existingCall.number === call.number
                    );
                    
                    if (!exists) {
                        this.history.push({
                            ...call,
                            id: this.generateCallId()
                        });
                        addedCount++;
                    }
                });
                
                // Ordenar por timestamp descendente
                this.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                this.saveHistory();
                this.updateFilteredHistory();
                this.renderHistory();
                
                this.app.showNotification(`${addedCount} llamadas importadas exitosamente`, 'success');
            } catch (error) {
                console.error('Error importing history:', error);
                this.app.showNotification('Error al importar historial', 'error');
            }
        };
        reader.readAsText(file);
    }

    /**
     * Obtiene resumen de llamadas por día
     */
    getDailySummary(days = 7) {
        const summary = {};
        const now = new Date();
        
        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            
            summary[dateKey] = {
                date: dateKey,
                total: 0,
                incoming: 0,
                outgoing: 0,
                missed: 0,
                duration: 0
            };
        }
        
        this.history.forEach(call => {
            const callDate = new Date(call.timestamp).toISOString().split('T')[0];
            if (summary[callDate]) {
                summary[callDate].total++;
                summary[callDate][call.type]++;
                if (call.status === 'missed') summary[callDate].missed++;
                if (call.duration) summary[callDate].duration += call.duration;
            }
        });
        
        return Object.values(summary).reverse();
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CallHistoryManager;
} else {
    window.CallHistoryManager = CallHistoryManager;
}