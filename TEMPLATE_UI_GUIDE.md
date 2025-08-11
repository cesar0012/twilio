# Guía de Elementos UI del Template Sneat

## Descripción General
Este template es una solución completa de administración basada en Laravel + Bootstrap con componentes UI modernos y responsivos.

## 🎨 Sistema de Estilos

### Colores Principales
```css
/* Basado en Bootstrap con personalizaciones */
.btn-primary     /* Color principal del tema */
.btn-secondary   /* Color secundario */
.btn-success     /* Verde para acciones exitosas */
.btn-danger      /* Rojo para acciones destructivas */
.btn-warning     /* Amarillo para advertencias */
.btn-info        /* Azul para información */
.btn-dark        /* Oscuro */
```

### Tipografía
- **Fuente Principal**: Google Fonts - Public Sans
- **Iconografía**: Boxicons
- **Tamaños**: Sistema responsive basado en rem

## 🧩 Componentes UI Principales

### 1. Botones
```html
<!-- Botones básicos -->
<button type="button" class="btn btn-primary">Primary</button>
<button type="button" class="btn btn-secondary">Secondary</button>
<button type="button" class="btn btn-success">Success</button>

<!-- Botones outline -->
<button type="button" class="btn btn-outline-primary">Outline Primary</button>
<button type="button" class="btn btn-outline-secondary">Outline Secondary</button>

<!-- Botones redondeados -->
<button type="button" class="btn btn-primary btn-rounded-pill">Rounded</button>
```

### 2. Cards
```html
<div class="card">
  <div class="card-header">
    <h5 class="card-title mb-0">Título de la Card</h5>
  </div>
  <div class="card-body">
    <p class="card-text">Contenido de la card</p>
    <a href="#" class="btn btn-primary">Acción</a>
  </div>
</div>
```

### 3. Alerts
```html
<div class="alert alert-success alert-dismissible" role="alert">
  ¡Operación exitosa!
  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
</div>

<div class="alert alert-danger" role="alert">
  Error en la operación
</div>
```

### 4. Modals
```html
<div class="modal fade" id="basicModal" tabindex="-1">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Título del Modal</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        Contenido del modal
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
        <button type="button" class="btn btn-primary">Guardar</button>
      </div>
    </div>
  </div>
</div>
```

### 5. Forms
```html
<form>
  <div class="mb-3">
    <label for="basicInput" class="form-label">Input Básico</label>
    <input type="text" class="form-control" id="basicInput" placeholder="Ingresa texto">
  </div>
  
  <div class="mb-3">
    <label for="basicSelect" class="form-label">Select</label>
    <select class="form-select" id="basicSelect">
      <option>Opción 1</option>
      <option>Opción 2</option>
    </select>
  </div>
  
  <div class="mb-3">
    <div class="form-check">
      <input class="form-check-input" type="checkbox" id="basicCheck">
      <label class="form-check-label" for="basicCheck">Checkbox</label>
    </div>
  </div>
</form>
```

### 6. Tables
```html
<div class="table-responsive">
  <table class="table table-striped table-hover">
    <thead>
      <tr>
        <th>Columna 1</th>
        <th>Columna 2</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dato 1</td>
        <td>Dato 2</td>
        <td>
          <button class="btn btn-sm btn-primary">Editar</button>
          <button class="btn btn-sm btn-danger">Eliminar</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

## 🏗️ Sistema de Layout

### Layout Principal
```php
@extends('layouts/contentNavbarLayout')

@section('title', 'Título de la Página')

@section('vendor-style')
<!-- CSS específico de vendors -->
@endsection

@section('vendor-script')
<!-- JS específico de vendors -->
@endsection

@section('page-script')
<!-- JS específico de la página -->
@endsection

@section('content')
<!-- Contenido principal -->
@endsection
```

### Estructura de Navegación
```json
// verticalMenu.json
{
  "url": "dashboard-analytics",
  "name": "Analytics",
  "icon": "bx bx-home-circle",
  "slug": "dashboard-analytics"
}
```

## 📱 Responsive Design

### Breakpoints
- **xs**: <576px
- **sm**: ≥576px
- **md**: ≥768px
- **lg**: ≥992px
- **xl**: ≥1200px
- **xxl**: ≥1400px

### Clases Responsive
```html
<div class="col-12 col-md-6 col-lg-4">
  <!-- Contenido responsive -->
</div>

<div class="d-none d-md-block">
  <!-- Visible solo en desktop -->
</div>

<div class="d-block d-md-none">
  <!-- Visible solo en mobile -->
</div>
```

## ⚡ JavaScript y Interactividad

### Inicialización de Componentes
```javascript
// Inicializar tooltips
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
});

// Inicializar modals
var myModal = new bootstrap.Modal(document.getElementById('myModal'));
```

### Event Handlers Comunes
```javascript
// Click en botones
$('.btn-action').on('click', function() {
  // Lógica del botón
});

// Submit de formularios
$('#myForm').on('submit', function(e) {
  e.preventDefault();
  // Validación y envío
});

// Toggle de elementos
$('.toggle-btn').on('click', function() {
  $(this).toggleClass('active');
});
```

## 🎯 Mejores Prácticas

### 1. Estructura de Archivos
- Mantener CSS en `resources/css/`
- JavaScript en `resources/js/`
- Imágenes en `public/assets/img/`

### 2. Nomenclatura
- Usar clases de Bootstrap como base
- Prefijos personalizados para estilos específicos
- Nombres descriptivos para IDs y clases

### 3. Performance
- Cargar CSS crítico inline
- Lazy loading para imágenes
- Minificación de assets en producción

### 4. Accesibilidad
- Usar roles ARIA apropiados
- Labels descriptivos en formularios
- Contraste adecuado en colores
- Navegación por teclado

## 🔧 Personalización

### Variables SCSS
```scss
// Personalizar colores principales
$primary: #696cff;
$secondary: #8592a3;
$success: #71dd37;
$danger: #ff3e1d;

// Personalizar tipografía
$font-family-sans-serif: 'Public Sans', sans-serif;
$font-size-base: 0.9375rem;
```

### Overrides CSS
```css
/* Personalizar componentes específicos */
.custom-card {
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(161, 172, 184, 0.15);
}

.custom-btn {
  border-radius: 0.375rem;
  font-weight: 500;
}
```

---

**Nota**: Esta guía está basada en el análisis del template Sneat. Todos los elementos deben ser copiados al proyecto principal antes de su uso, nunca consumir directamente desde la carpeta Template.