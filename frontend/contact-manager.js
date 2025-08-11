/**
 * ContactManager - Gestión de contactos
 * Maneja el almacenamiento, búsqueda y gestión de contactos
 */

class ContactManager {
    constructor(app) {
        this.app = app;
        this.storageKey = 'twilio_contacts';
        this.contacts = [];
        this.filteredContacts = [];
        this.currentEditingContact = null;
        
        this.loadContacts();
    }

    /**
     * Carga contactos desde localStorage
     */
    loadContacts() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.contacts = stored ? JSON.parse(stored) : [];
            this.filteredContacts = [...this.contacts];
            console.log(`Loaded ${this.contacts.length} contacts`);
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.contacts = [];
            this.filteredContacts = [];
        }
    }

    /**
     * Guarda contactos en localStorage
     */
    saveContacts() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.contacts));
            console.log('Contacts saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving contacts:', error);
            this.app.showNotification('Error al guardar contactos', 'error');
            return false;
        }
    }

    /**
     * Agrega un nuevo contacto
     */
    addContact(contactData) {
        try {
            // Validar datos
            if (!this.validateContactData(contactData)) {
                throw new Error('Datos de contacto inválidos');
            }

            // Verificar si ya existe
            if (this.findContactByPhone(contactData.phone)) {
                throw new Error('Ya existe un contacto con este número');
            }

            const newContact = {
                id: this.generateContactId(),
                name: contactData.name.trim(),
                phone: this.formatPhoneNumber(contactData.phone),
                email: contactData.email ? contactData.email.trim() : '',
                company: contactData.company ? contactData.company.trim() : '',
                notes: contactData.notes ? contactData.notes.trim() : '',
                avatar: contactData.avatar || this.generateAvatar(contactData.name),
                favorite: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                callCount: 0,
                lastCall: null
            };

            this.contacts.push(newContact);
            this.saveContacts();
            this.updateFilteredContacts();
            this.renderContacts();
            
            this.app.showNotification('Contacto agregado exitosamente', 'success');
            console.log('Contact added:', newContact);
            
            return newContact;
        } catch (error) {
            console.error('Error adding contact:', error);
            this.app.showNotification(error.message, 'error');
            return null;
        }
    }

    /**
     * Actualiza un contacto existente
     */
    updateContact(contactId, contactData) {
        try {
            const contactIndex = this.contacts.findIndex(c => c.id === contactId);
            if (contactIndex === -1) {
                throw new Error('Contacto no encontrado');
            }

            // Validar datos
            if (!this.validateContactData(contactData)) {
                throw new Error('Datos de contacto inválidos');
            }

            // Verificar duplicados (excluyendo el contacto actual)
            const existingContact = this.findContactByPhone(contactData.phone);
            if (existingContact && existingContact.id !== contactId) {
                throw new Error('Ya existe otro contacto con este número');
            }

            const updatedContact = {
                ...this.contacts[contactIndex],
                name: contactData.name.trim(),
                phone: this.formatPhoneNumber(contactData.phone),
                email: contactData.email ? contactData.email.trim() : '',
                company: contactData.company ? contactData.company.trim() : '',
                notes: contactData.notes ? contactData.notes.trim() : '',
                updatedAt: new Date().toISOString()
            };

            this.contacts[contactIndex] = updatedContact;
            this.saveContacts();
            this.updateFilteredContacts();
            this.renderContacts();
            
            this.app.showNotification('Contacto actualizado exitosamente', 'success');
            console.log('Contact updated:', updatedContact);
            
            return updatedContact;
        } catch (error) {
            console.error('Error updating contact:', error);
            this.app.showNotification(error.message, 'error');
            return null;
        }
    }

    /**
     * Elimina un contacto
     */
    deleteContact(contactId) {
        try {
            const contactIndex = this.contacts.findIndex(c => c.id === contactId);
            if (contactIndex === -1) {
                throw new Error('Contacto no encontrado');
            }

            const deletedContact = this.contacts.splice(contactIndex, 1)[0];
            this.saveContacts();
            this.updateFilteredContacts();
            this.renderContacts();
            
            this.app.showNotification('Contacto eliminado', 'info');
            console.log('Contact deleted:', deletedContact);
            
            return true;
        } catch (error) {
            console.error('Error deleting contact:', error);
            this.app.showNotification(error.message, 'error');
            return false;
        }
    }

    /**
     * Busca contactos
     */
    searchContacts(query) {
        if (!query || query.trim() === '') {
            this.filteredContacts = [...this.contacts];
        } else {
            const searchTerm = query.toLowerCase().trim();
            this.filteredContacts = this.contacts.filter(contact => 
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.phone.includes(searchTerm) ||
                (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
                (contact.company && contact.company.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderContacts();
        return this.filteredContacts;
    }

    /**
     * Encuentra un contacto por número de teléfono
     */
    findContactByPhone(phoneNumber) {
        const formatted = this.formatPhoneNumber(phoneNumber);
        return this.contacts.find(contact => contact.phone === formatted);
    }

    /**
     * Encuentra un contacto por ID
     */
    findContactById(contactId) {
        return this.contacts.find(contact => contact.id === contactId);
    }

    /**
     * Alterna el estado de favorito de un contacto
     */
    toggleFavorite(contactId) {
        const contact = this.findContactById(contactId);
        if (contact) {
            contact.favorite = !contact.favorite;
            contact.updatedAt = new Date().toISOString();
            this.saveContacts();
            this.renderContacts();
            
            const message = contact.favorite ? 'Agregado a favoritos' : 'Removido de favoritos';
            this.app.showNotification(message, 'info');
        }
    }

    /**
     * Actualiza estadísticas de llamada para un contacto
     */
    updateCallStats(phoneNumber) {
        const contact = this.findContactByPhone(phoneNumber);
        if (contact) {
            contact.callCount++;
            contact.lastCall = new Date().toISOString();
            contact.updatedAt = new Date().toISOString();
            this.saveContacts();
        }
    }

    /**
     * Obtiene contactos favoritos
     */
    getFavoriteContacts() {
        return this.contacts.filter(contact => contact.favorite)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Obtiene contactos frecuentes
     */
    getFrequentContacts(limit = 5) {
        return this.contacts
            .filter(contact => contact.callCount > 0)
            .sort((a, b) => b.callCount - a.callCount)
            .slice(0, limit);
    }

    /**
     * Renderiza la lista de contactos
     */
    renderContacts() {
        const contactsList = this.app.elements.contactsList;
        if (!contactsList) return;

        if (this.filteredContacts.length === 0) {
            contactsList.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-address-book fa-3x mb-3"></i>
                    <p>No hay contactos</p>
                    <button class="btn btn-primary btn-sm" onclick="twilioApp.contactManager.showAddContactForm()">
                        <i class="fas fa-plus"></i> Agregar Contacto
                    </button>
                </div>
            `;
            return;
        }

        const contactsHTML = this.filteredContacts
            .sort((a, b) => {
                // Favoritos primero, luego alfabético
                if (a.favorite && !b.favorite) return -1;
                if (!a.favorite && b.favorite) return 1;
                return a.name.localeCompare(b.name);
            })
            .map(contact => this.renderContactItem(contact))
            .join('');

        contactsList.innerHTML = contactsHTML;
    }

    /**
     * Renderiza un item de contacto
     */
    renderContactItem(contact) {
        const lastCallText = contact.lastCall ? 
            `Última llamada: ${new Date(contact.lastCall).toLocaleDateString()}` : 
            'Sin llamadas';

        return `
            <div class="contact-item" data-contact-id="${contact.id}">
                <div class="contact-avatar">
                    <img src="${contact.avatar}" alt="${contact.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2Yzc1N2QiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOC42ODYyOSAxNCA2IDE2LjY4NjMgNiAyMFYyMkgxOFYyMEMxOCAxNi42ODYzIDE1LjMxMzcgMTQgMTIgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+'">
                    ${contact.favorite ? '<i class="fas fa-star favorite-star"></i>' : ''}
                </div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-phone">${contact.phone}</div>
                    ${contact.company ? `<div class="contact-company">${contact.company}</div>` : ''}
                    <div class="contact-stats">${lastCallText} • ${contact.callCount} llamadas</div>
                </div>
                <div class="contact-actions">
                    <button class="btn btn-sm btn-outline-success" onclick="twilioApp.contactManager.callContact('${contact.id}')" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="twilioApp.contactManager.editContact('${contact.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="twilioApp.contactManager.toggleFavorite('${contact.id}')" title="${contact.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                        <i class="fas fa-star${contact.favorite ? '' : '-o'}"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="twilioApp.contactManager.confirmDeleteContact('${contact.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Llama a un contacto
     */
    callContact(contactId) {
        const contact = this.findContactById(contactId);
        if (contact && this.app.elements.phoneInput) {
            this.app.elements.phoneInput.value = contact.phone;
            this.app.makeCall();
        }
    }

    /**
     * Muestra el formulario para agregar contacto
     */
    showAddContactForm() {
        this.currentEditingContact = null;
        this.populateContactForm();
        this.app.showContactForm();
    }

    /**
     * Edita un contacto
     */
    editContact(contactId) {
        const contact = this.findContactById(contactId);
        if (contact) {
            this.currentEditingContact = contact;
            this.populateContactForm(contact);
            this.app.showContactForm();
        }
    }

    /**
     * Confirma la eliminación de un contacto
     */
    confirmDeleteContact(contactId) {
        const contact = this.findContactById(contactId);
        if (contact) {
            Swal.fire({
                title: '¿Estás seguro?',
                text: `¿Quieres eliminar el contacto "${contact.name}"?`,
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
                    this.deleteContact(contact.id);
                }
            });
        }
    }

    /**
     * Guarda el contacto desde el formulario
     */
    saveContactFromForm() {
        const form = this.app.elements.contactFormElement;
        if (!form) return;

        const formData = new FormData(form);
        const contactData = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            company: formData.get('company'),
            notes: formData.get('notes')
        };

        let result;
        if (this.currentEditingContact) {
            result = this.updateContact(this.currentEditingContact.id, contactData);
        } else {
            result = this.addContact(contactData);
        }

        if (result) {
            this.app.hideContactForm();
            form.reset();
        }
    }

    /**
     * Puebla el formulario de contacto
     */
    populateContactForm(contact = null) {
        const form = this.app.elements.contactFormElement;
        if (!form) return;

        if (contact) {
            form.name.value = contact.name || '';
            form.phone.value = contact.phone || '';
            form.email.value = contact.email || '';
            form.company.value = contact.company || '';
            form.notes.value = contact.notes || '';
        } else {
            form.reset();
        }
    }

    /**
     * Actualiza la lista filtrada
     */
    updateFilteredContacts() {
        this.filteredContacts = [...this.contacts];
    }

    /**
     * Valida los datos de un contacto
     */
    validateContactData(contactData) {
        if (!contactData.name || contactData.name.trim() === '') {
            throw new Error('El nombre es requerido');
        }

        if (!contactData.phone || contactData.phone.trim() === '') {
            throw new Error('El teléfono es requerido');
        }

        if (contactData.email && !this.isValidEmail(contactData.email)) {
            throw new Error('Email inválido');
        }

        return true;
    }

    /**
     * Valida un email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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
     * Genera un ID único para contacto
     */
    generateContactId() {
        return 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Genera un avatar por defecto
     */
    generateAvatar(name) {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substr(0, 2);
        const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
        const color = colors[name.length % colors.length];
        
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="${color}"/>
                <text x="20" y="26" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${initials}</text>
            </svg>
        `)}`;
    }

    /**
     * Exporta contactos
     */
    exportContacts() {
        const dataStr = JSON.stringify(this.contacts, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `twilio_contacts_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    /**
     * Importa contactos
     */
    importContacts(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedContacts = JSON.parse(e.target.result);
                let addedCount = 0;
                
                importedContacts.forEach(contact => {
                    if (this.validateContactData(contact) && !this.findContactByPhone(contact.phone)) {
                        this.contacts.push({
                            ...contact,
                            id: this.generateContactId(),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                        addedCount++;
                    }
                });
                
                this.saveContacts();
                this.updateFilteredContacts();
                this.renderContacts();
                
                this.app.showNotification(`${addedCount} contactos importados exitosamente`, 'success');
            } catch (error) {
                console.error('Error importing contacts:', error);
                this.app.showNotification('Error al importar contactos', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContactManager;
} else {
    window.ContactManager = ContactManager;
}