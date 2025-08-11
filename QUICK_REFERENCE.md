# 🚀 Referencia Rápida - Template UI

## 📋 Checklist de Implementación

### ✅ Antes de usar elementos del template:
- [ ] Copiar archivos necesarios desde `Template/` al proyecto principal
- [ ] No referenciar directamente archivos en `Template/`
- [ ] Verificar dependencias (Bootstrap, jQuery, etc.)
- [ ] Adaptar rutas de assets al proyecto

## 🎨 Componentes Más Utilizados

### Botones
```html
<button class="btn btn-primary">Primario</button>
<button class="btn btn-outline-secondary">Secundario</button>
<button class="btn btn-sm btn-success">Pequeño</button>
```

### Cards
```html
<div class="card">
  <div class="card-header"><h5>Título</h5></div>
  <div class="card-body">Contenido</div>
</div>
```

### Alerts
```html
<div class="alert alert-success alert-dismissible">
  Mensaje
  <button class="btn-close" data-bs-dismiss="alert"></button>
</div>
```

### Forms
```html
<div class="mb-3">
  <label class="form-label">Label</label>
  <input type="text" class="form-control" placeholder="Placeholder">
</div>
```

## 🎯 Clases CSS Esenciales

### Layout
- `container-xxl` - Container responsive
- `row` / `col-*` - Grid system
- `d-flex` / `justify-content-*` - Flexbox

### Spacing
- `m-*` / `p-*` - Margin/Padding (0-5)
- `mb-3` / `mt-4` - Margin específico
- `px-3` / `py-2` - Padding horizontal/vertical

### Display
- `d-none` / `d-block` - Mostrar/Ocultar
- `d-md-block` - Responsive display
- `text-center` / `text-end` - Alineación

## ⚡ JavaScript Común

### Inicialización
```javascript
// Tooltips
var tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
tooltips.forEach(el => new bootstrap.Tooltip(el));

// Modals
var modal = new bootstrap.Modal(document.getElementById('myModal'));
```

### Event Handlers
```javascript
// Click events
$('.btn-action').on('click', function() {
  // Acción
});

// Form submission
$('#form').on('submit', function(e) {
  e.preventDefault();
  // Validar y enviar
});
```

## 🔧 Estructura de Archivos Recomendada

```
proyecto/
├── public/
│   ├── css/
│   │   └── app.css
│   ├── js/
│   │   └── app.js
│   └── assets/
│       ├── img/
│       └── fonts/
├── resources/
│   ├── views/
│   │   ├── layouts/
│   │   └── components/
│   ├── css/
│   └── js/
└── TEMPLATE_UI_GUIDE.md
```

## 🎨 Paleta de Colores

- **Primary**: `#696cff` (Azul principal)
- **Secondary**: `#8592a3` (Gris)
- **Success**: `#71dd37` (Verde)
- **Danger**: `#ff3e1d` (Rojo)
- **Warning**: `#ffb400` (Amarillo)
- **Info**: `#03c3ec` (Azul claro)

## 📱 Breakpoints Responsive

- **xs**: < 576px (Mobile)
- **sm**: ≥ 576px (Mobile grande)
- **md**: ≥ 768px (Tablet)
- **lg**: ≥ 992px (Desktop)
- **xl**: ≥ 1200px (Desktop grande)
- **xxl**: ≥ 1400px (Desktop extra grande)

## 🚨 Recordatorios Importantes

1. **NO** consumir archivos directamente desde `Template/`
2. **SIEMPRE** copiar elementos necesarios al proyecto principal
3. **VERIFICAR** dependencias antes de implementar
4. **ADAPTAR** rutas y referencias al proyecto actual
5. **TESTEAR** responsividad en diferentes dispositivos

---

💡 **Tip**: Consulta `TEMPLATE_UI_GUIDE.md` para documentación completa y ejemplos detallados.