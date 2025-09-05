// Fix para pestañas de configuración
document.addEventListener('DOMContentLoaded', function() {
    // Obtener todos los botones de pestañas
    const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Función para mostrar una pestaña específica
    function showTab(targetId) {
        // Ocultar todas las pestañas
        tabPanes.forEach(pane => {
            pane.classList.remove('active', 'show');
            pane.style.display = 'none';
        });
        
        // Desactivar todos los botones
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        
        // Mostrar la pestaña objetivo
        const targetPane = document.querySelector(targetId);
        if (targetPane) {
            targetPane.classList.add('active', 'show');
            targetPane.style.display = 'block';
        }
        
        // Activar el botón correspondiente
        const activeButton = document.querySelector(`[data-bs-target="${targetId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            activeButton.setAttribute('aria-selected', 'true');
        }
    }
    
    // Agregar event listeners a todos los botones de pestañas
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-bs-target');
            if (targetId) {
                showTab(targetId);
            }
        });
    });
    
    // Mostrar la primera pestaña por defecto
    if (tabButtons.length > 0) {
        const firstTarget = tabButtons[0].getAttribute('data-bs-target');
        if (firstTarget) {
            showTab(firstTarget);
        }
    }
    
    console.log('✅ Tab fix cargado correctamente');
});