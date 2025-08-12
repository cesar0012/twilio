# --- CAMBIO 1: Importar 'send_from_directory' ---
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
from twilio.rest import Client as TwilioRestClient
import os

# --- CAMBIO 2: Configurar Flask para que sepa dónde está el frontend ---
# La ruta '../frontend' le dice a Flask que suba un nivel desde 'backend' y entre a 'frontend'
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # Permitir CORS para comunicación frontend-backend

# --- CAMBIO 3: Añadir la ruta principal para servir index.html ---
@app.route('/')
def serve_index():
    # Esta función sirve el archivo principal de tu frontend.
    return send_from_directory(app.static_folder, 'index.html')

# --- TU CÓDIGO EXISTENTE (SIN CAMBIOS) ---

@app.route('/token', methods=['POST'])
def generate_token():
    """
    Genera un AccessToken de Twilio usando las credenciales enviadas desde el frontend
    """
    try:
        print("[DEBUG] Recibida solicitud de token")
        data = request.get_json()
        print(f"[DEBUG] Datos recibidos: {data}")
        
        # Extraer credenciales del request
        account_sid = data.get('accountSid')
        api_key_sid = data.get('apiKeySid')
        api_key_secret = data.get('apiKeySecret')
        twiml_app_sid = data.get('twimlAppSid')
        twilio_phone_number = data.get('twilioPhoneNumber')
        
        print(f"[DEBUG] Credenciales extraídas - Account SID: {account_sid[:10]}..., API Key: {api_key_sid[:10]}..., TwiML App: {twiml_app_sid[:10]}..., Phone: {twilio_phone_number}")
        
        # Validar que todas las credenciales estén presentes
        if not all([account_sid, api_key_sid, api_key_secret, twiml_app_sid, twilio_phone_number]):
            print("[ERROR] Faltan credenciales requeridas")
            return jsonify({'error': 'Faltan credenciales requeridas'}), 400
        
        print("[DEBUG] Creando AccessToken...")
        # Crear AccessToken
        token = AccessToken(
            account_sid,
            api_key_sid,
            api_key_secret,
            identity='browser_client'
        )
        
        print("[DEBUG] Creando VoiceGrant...")
        # Crear VoiceGrant
        voice_grant = VoiceGrant(
            outgoing_application_sid=twiml_app_sid,
            incoming_allow=True
        )
        
        print("[DEBUG] Agregando grant al token...")
        # Agregar el grant al token
        token.add_grant(voice_grant)
        
        jwt_token = token.to_jwt()
        print(f"[DEBUG] Token generado exitosamente. Longitud: {len(jwt_token)}")
        
        return jsonify({
            'token': jwt_token,
            'identity': 'browser_client'
        })
        
    except Exception as e:
        print(f"[ERROR] Error generando token: {str(e)}")
        print(f"[ERROR] Tipo de error: {type(e).__name__}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Error generando token: {str(e)}'}), 500

@app.route('/handle_calls', methods=['POST'])
def handle_calls():
    """
    Webhook para manejar llamadas entrantes y salientes
    """

    # --- PASO DE DEPURACIÓN MEJORADO ---
    print("\n--- INICIO DE WEBHOOK /handle_calls ---")
    all_params = request.form.to_dict()
    print(f"Parámetros recibidos de Twilio: {all_params}")
    print("--- FIN DE WEBHOOK ---\n")
    # ----------------------------------------

    response = VoiceResponse()
    try:
        # Si la llamada viene del navegador (identificada por 'client:'), es una llamada SALIENTE
        # Extraer los parámetros 'To' y 'From' de la solicitud de Twilio
        to_param = request.form.get('To')
        from_param = request.form.get('From')

        # Si 'To' es un número de teléfono, es una llamada saliente desde el cliente.
        # La TwiML App debería haber sido configurada con un 'Request URL' que maneje esto.
        # Twilio convierte los parámetros de device.connect() en parámetros de formulario POST.
        if to_param and to_param.startswith('client:'):
            # Es una llamada ENTRANTE a un cliente específico.
            dial = response.dial()
            dial.client(to_param.split(':')[1])
        elif from_param and from_param.startswith('client:'):
            # Es una llamada SALIENTE desde un cliente.
            # El 'To' es el número de teléfono a marcar.
            # El 'callerId' debe ser tu número de Twilio verificado, que debería estar en la TwiML App.
            # Como no se pasa, lo tomaremos del `request.form.get('twilio_phone_number')` si existe.
            # ¡Pero OJO! Los parámetros de `device.connect()` NO se pasan al webhook de la TwiML App.
            # Se deben pasar en la URL del webhook o el `callerId` debe estar en la TwiML App.
            # Vamos a asumir que la TwiML App está configurada con el Caller ID.

            # El `To` que viene de `device.connect` es el número a marcar.
            number_to_dial = to_param
            # El `callerId` lo debe poner la TwiML App. Twilio envía el `From` como el número verificado.
            # En una llamada saliente desde el cliente, el `From` es el `client:identity`.
            # Pero el `CallerId` de la petición al webhook es el número de Twilio.
            caller_id = request.form.get('Caller')

            dial = response.dial(caller_id=caller_id)
            dial.number(number_to_dial)
        else:
            # Es una llamada entrante a un número de Twilio.
            # Reenviar al cliente del navegador.
            dial = response.dial()
            dial.client('browser_client')

        return str(response), 200, {'Content-Type': 'text/xml'}
        
    except Exception as e:
        print(f"\n!!! ERROR DENTRO DEL BLOQUE TRY: {e} !!!\n")
        response = VoiceResponse()
        response.say('Lo sentimos, ha ocurrido un error. La llamada será terminada.')
        response.hangup()
        return str(response), 200, {'Content-Type': 'text/xml'}


@app.route('/sms', methods=['POST'])
def send_sms():
    """
    Envía un mensaje SMS usando las credenciales y datos proporcionados.
    """
    try:
        print("[DEBUG] Recibida solicitud de envío de SMS")
        data = request.get_json()
        print(f"[DEBUG] Datos recibidos para SMS: {data}")

        # Extraer credenciales y datos del mensaje
        account_sid = data.get('accountSid')
        auth_token = data.get('authToken')
        twilio_phone_number = data.get('twilioPhoneNumber')
        recipient_phone_number = data.get('recipientPhoneNumber')
        message_body = data.get('message')

        # Validar que todos los datos necesarios estén presentes
        if not all([account_sid, auth_token, twilio_phone_number, recipient_phone_number, message_body]):
            print("[ERROR] Faltan datos para enviar el SMS")
            return jsonify({'error': 'Faltan datos requeridos para el envío de SMS'}), 400

        print(f"[DEBUG] Enviando SMS desde {twilio_phone_number} hacia {recipient_phone_number}")
        # Inicializar el cliente de Twilio
        client = TwilioRestClient(account_sid, auth_token)

        # Enviar el mensaje
        message = client.messages.create(
            to=recipient_phone_number,
            from_=twilio_phone_number,
            body=message_body
        )

        print(f"[DEBUG] SMS enviado exitosamente. SID del mensaje: {message.sid}")
        return jsonify({'success': True, 'message_sid': message.sid})

    except Exception as e:
        print(f"[ERROR] Error enviando SMS: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Error enviando SMS: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint de verificación de salud del servidor
    """
    return jsonify({'status': 'OK', 'message': 'Servidor Twilio WebApp funcionando correctamente'})

if __name__ == '__main__':
    # Ejecutar en modo debug para desarrollo local
    app.run(debug=True, host='0.0.0.0', port=5000)