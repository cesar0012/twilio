# Twilio Voice App 📞

Una aplicación web moderna para realizar y recibir llamadas usando Twilio Voice SDK.

## 🚀 Deployment con Coolify (Recomendado)

Este proyecto está configurado para deployment fácil con Coolify:

### Requisitos previos:
- VPS con Ubuntu 24 LTS
- Coolify instalado en tu VPS
- Repositorio en GitHub
- Credenciales de Twilio

### Pasos para deployment:

1. **Subir a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/twilio-app.git
   git push -u origin main
   ```

2. **Configurar en Coolify:**
   - Crear nueva aplicación
   - Conectar repositorio GitHub
   - Deploy automático 🎉

3. **Configurar webhook en Twilio:**
   - URL: `https://tu-app.tu-dominio.com/handle_calls`
   - Método: POST

## 🛠️ Desarrollo Local

1. **Instalar dependencias:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configurar variables de entorno (opcional para desarrollo):**
   ```bash
   cp .env.example .env
   # Solo necesario si quieres configurar el puerto o debug mode
   ```

3. **Ejecutar la aplicación:**
   ```bash
   python app.py
   ```

4. **Exponer con ngrok (para webhooks):**
   ```bash
   ngrok http 5000
   ```

5. **Abrir en el navegador:**
   ```
   http://localhost:5000
   ```

## 🔑 Credenciales de Twilio Requeridas

Las credenciales se configuran directamente en la interfaz web de la aplicación:

| Credencial | Descripción | Dónde obtenerla |
|------------|-------------|------------------|
| **Account SID** | Tu Account SID | Twilio Console > Dashboard |
| **Auth Token** | Tu Auth Token | Twilio Console > Dashboard |
| **TwiML App SID** | SID de tu TwiML App | Twilio Console > Voice > TwiML Apps |
| **Caller ID** | Tu número Twilio | Twilio Console > Phone Numbers |

> 💡 **Nota:** Las credenciales se guardan en localStorage del navegador y no se envían al servidor.

## ✨ Funcionalidades

- ✅ Realizar llamadas salientes
- ✅ Recibir llamadas entrantes
- ✅ Interfaz web moderna y responsive
- ✅ Manejo de errores robusto
- ✅ Logs detallados
- ✅ Compatible con Twilio Voice SDK 2.0+
- ✅ Deployment automático con Coolify
- ✅ SSL automático

## 🔧 Tecnologías

- **Backend:** Flask + Gunicorn
- **Frontend:** HTML5 + CSS3 + JavaScript
- **Twilio:** Voice SDK 2.0+
- **Deployment:** Coolify + Nixpacks
- **SSL:** Let's Encrypt (automático)

## Configuración Avanzada

### Configurar TwiML App en Twilio

1. Ir a [Twilio Console > TwiML Apps](https://console.twilio.com/us1/develop/voice/manage/twiml-apps)
2. Crear una nueva TwiML App
3. Configurar los webhooks:
   - **Voice Request URL**: `https://tu-app.tu-dominio.com/voice`
   - **Voice Status Callback URL**: `https://tu-app.tu-dominio.com/status`
4. Guardar el **TwiML App SID**

### Uso de la Aplicación

1. **Abrir la aplicación** en tu navegador
2. **Configurar credenciales** en la sección "Configuración de Credenciales":
   - Account SID
   - Auth Token  
   - TwiML App SID
   - Caller ID (tu número Twilio)
3. **Guardar credenciales** (se almacenan en localStorage)
4. **Conectar** a Twilio haciendo clic en "Conectar"
5. **Realizar llamadas** ingresando números con código de país
6. **Recibir llamadas** automáticamente cuando alguien llame a tu número Twilio

## 🏗️ Estructura del Proyecto

```
twilio-app/
├── backend/
│   ├── app.py              # Servidor Flask
│   ├── requirements.txt    # Dependencias Python + Gunicorn
│   └── .env.example       # Variables de entorno ejemplo
├── frontend/
│   ├── index.html         # Interfaz principal
│   ├── css/
│   │   └── style.css      # Estilos
│   └── js/
│       ├── app.js         # Lógica principal
│       ├── phone.js       # Manejo de llamadas
│       ├── credentials.js # Configuración
│       └── twilio.min.js  # SDK Twilio
├── nixpacks.toml          # Configuración Coolify
├── .gitignore             # Archivos a ignorar
└── instructions.md        # Instrucciones detalladas
```

## API Endpoints

### POST /token
Genera un Access Token de Twilio para el cliente.

**Request Body:**
```json
{
  "accountSid": "ACxxxxx",
  "authToken": "xxxxx",
  "twimlAppSid": "APxxxxx",
  "callerIdNumber": "+1234567890"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /voice
Webhook para manejar llamadas entrantes y salientes.

### POST /status
Webhook para recibir actualizaciones de estado de llamadas.

### GET /health
Endpoint de salud para verificar que el servidor está funcionando.

## Solución de Problemas

### Error: "SDK de Twilio no está cargado"
- Verificar conexión a internet
- Asegurar que el CDN de Twilio esté accesible

### Error: "No se pudo obtener el token de acceso"
- Verificar que el backend esté ejecutándose
- Verificar credenciales de Twilio
- Revisar logs del servidor Flask

### Error: "Device no está conectado"
- Verificar que se haya hecho clic en "Conectar"
- Verificar que las credenciales sean válidas
- Revisar la consola del navegador para errores

### Las llamadas entrantes no funcionan
- Verificar que ngrok esté ejecutándose
- Verificar que la TwiML App tenga la URL correcta de ngrok
- Verificar que el número de Twilio esté configurado para usar la TwiML App

### Error de CORS
- Verificar que Flask-CORS esté instalado
- Verificar que el backend permita el origen del frontend

## Desarrollo

### Agregar Nuevas Características
1. **Backend**: Modificar `backend/app.py`
2. **Frontend**: Agregar módulos en `frontend/js/`
3. **Estilos**: Modificar `frontend/css/style.css`

### Debugging
- **Backend**: Revisar logs en la terminal donde se ejecuta Flask
- **Frontend**: Usar Developer Tools del navegador (F12)
- **Twilio**: Revisar logs en [Twilio Console](https://console.twilio.com/)

## Seguridad

⚠️ **Importante**: Esta aplicación está diseñada para desarrollo y pruebas. Para producción:

1. **No exponer credenciales**: Usar variables de entorno
2. **HTTPS**: Usar certificados SSL válidos
3. **Validación**: Implementar validación robusta en el backend
4. **Rate Limiting**: Implementar límites de velocidad
5. **Autenticación**: Agregar autenticación de usuarios

## Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 📚 Documentación Adicional

Para configuración avanzada y troubleshooting, consulta `instructions.md`.

## 🆘 Soporte

Para problemas relacionados con Twilio, consultar:
- [Documentación de Twilio](https://www.twilio.com/docs)
- [Soporte de Twilio](https://support.twilio.com/)

Para problemas con esta aplicación:
- Revisar los logs del servidor y navegador
- Verificar la configuración de webhooks en Twilio
- Asegurar que todas las dependencias estén instaladas