# --- CAMBIO 1: Importar 'send_from_directory' ---
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
from twilio.rest import Client
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
        from_identity = request.form.get('From')
        
        # Si la llamada viene del navegador, es una llamada SALIENTE
        if from_identity and from_identity.startswith('client:'):
            
            # Obtener el número de teléfono de Twilio desde las credenciales
            caller_id = request.form.get('FromNumber')
            print(f"Caller ID (FromNumber): {caller_id}") # Depuración

            # Obtener el número a llamar desde la solicitud del frontend
            number_to_dial = request.form.get('PhoneNumber')
            print(f"Número a llamar (PhoneNumber): {number_to_dial}") # Depuración

            if caller_id and number_to_dial:
                dial = response.dial(caller_id=caller_id)
                dial.number(number_to_dial)
            else:
                response.say("Error: You are not allowed to make this call.")
        
        else: # Llamada entrante
            print("Llamada entrante detectada. Conectando al cliente del navegador.")
            dial = response.dial()
            dial.client('browser_client')

        return str(response), 200, {'Content-Type': 'text/xml'}
        
    except Exception as e:
        print(f"\n!!! ERROR DENTRO DEL BLOQUE TRY: {e} !!!\n")
        response = VoiceResponse()
        response.say('Lo sentimos, ha ocurrido un error. La llamada será terminada.')
        response.hangup()
        return str(response), 200, {'Content-Type': 'text/xml'}

@app.route('/phone-numbers', methods=['POST'])
def get_phone_numbers():
    """
    Obtiene los números de teléfono de Twilio usando las credenciales proporcionadas
    """
    try:
        print("[DEBUG] Recibida solicitud de números de teléfono")
        data = request.get_json()
        print(f"[DEBUG] Datos recibidos: {data}")
        
        # Extraer credenciales del request
        account_sid = data.get('accountSid')
        auth_token = data.get('authToken')
        
        print(f"[DEBUG] Credenciales extraídas - Account SID: {account_sid[:10] if account_sid else 'None'}..., Auth Token: {'***' if auth_token else 'None'}")
        
        # Validar que las credenciales estén presentes
        if not all([account_sid, auth_token]):
            print("[ERROR] Faltan credenciales requeridas (accountSid y authToken)")
            return jsonify({'error': 'Faltan credenciales requeridas (accountSid y authToken)'}), 400
        
        print("[DEBUG] Creando cliente de Twilio...")
        # Crear cliente de Twilio
        client = Client(account_sid, auth_token)
        
        print("[DEBUG] Obteniendo números de teléfono...")
        # Obtener números de teléfono
        phone_numbers = client.incoming_phone_numbers.list()
        
        # Formatear la respuesta
        numbers_data = []
        for number in phone_numbers:
            numbers_data.append({
                'sid': number.sid,
                'phoneNumber': number.phone_number,
                'friendlyName': number.friendly_name,
                'capabilities': {
                    'voice': number.capabilities.get('voice', False),
                    'sms': number.capabilities.get('sms', False),
                    'mms': number.capabilities.get('mms', False)
                }
            })
        
        print(f"[DEBUG] Se encontraron {len(numbers_data)} números de teléfono")
        
        return jsonify({
            'phoneNumbers': numbers_data,
            'count': len(numbers_data)
        })
        
    except Exception as e:
        print(f"[ERROR] Error obteniendo números de teléfono: {str(e)}")
        print(f"[ERROR] Tipo de error: {type(e).__name__}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Error obteniendo números de teléfono: {str(e)}'}), 500

@app.route('/send-sms', methods=['POST'])
def send_sms():
    """
    Envía un mensaje SMS usando Twilio
    """
    try:
        print("[DEBUG] Recibida solicitud de envío de SMS")
        data = request.get_json()
        print(f"[DEBUG] Datos recibidos: {data}")
        
        # Extraer datos del request
        account_sid = data.get('accountSid')
        auth_token = data.get('authToken')
        from_number = data.get('from')
        to_number = data.get('to')
        message_body = data.get('body')
        
        print(f"[DEBUG] Enviando SMS de {from_number} a {to_number}")
        
        # Validar que todos los datos estén presentes
        if not all([account_sid, auth_token, from_number, to_number, message_body]):
            print("[ERROR] Faltan datos requeridos para enviar SMS")
            return jsonify({'error': 'Faltan datos requeridos para enviar SMS'}), 400
        
        # Crear cliente de Twilio
        client = Client(account_sid, auth_token)
        
        # Enviar mensaje
        message = client.messages.create(
            body=message_body,
            from_=from_number,
            to=to_number
        )
        
        print(f"[DEBUG] SMS enviado exitosamente. SID: {message.sid}")
        
        return jsonify({
            'success': True,
            'messageSid': message.sid,
            'status': message.status
        })
        
    except Exception as e:
        print(f"[ERROR] Error enviando SMS: {str(e)}")
        print(f"[ERROR] Tipo de error: {type(e).__name__}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Error enviando SMS: {str(e)}'}), 500

@app.route('/messages', methods=['POST'])
def get_messages():
    """
    Obtiene los mensajes SMS de Twilio
    """
    try:
        print("[DEBUG] Recibida solicitud de mensajes")
        data = request.get_json()
        
        # Extraer credenciales del request
        account_sid = data.get('accountSid')
        auth_token = data.get('authToken')
        phone_number = data.get('phoneNumber')
        
        # Validar que las credenciales estén presentes
        if not all([account_sid, auth_token]):
            print("[ERROR] Faltan credenciales requeridas")
            return jsonify({'error': 'Faltan credenciales requeridas'}), 400
        
        # Crear cliente de Twilio
        client = Client(account_sid, auth_token)
        
        # Obtener mensajes
        messages = client.messages.list(
            limit=50,
            to=phone_number if phone_number else None
        )
        
        # Formatear la respuesta
        messages_data = []
        for message in messages:
            messages_data.append({
                'sid': message.sid,
                'from': message.from_,
                'to': message.to,
                'body': message.body,
                'status': message.status,
                'direction': message.direction,
                'dateCreated': message.date_created.isoformat() if message.date_created else None
            })
        
        print(f"[DEBUG] Se encontraron {len(messages_data)} mensajes")
        
        return jsonify({
            'messages': messages_data,
            'count': len(messages_data)
        })
        
    except Exception as e:
        print(f"[ERROR] Error obteniendo mensajes: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Error obteniendo mensajes: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint de verificación de salud del servidor
    """
    return jsonify({'status': 'OK', 'message': 'Servidor Twilio WebApp funcionando correctamente'})

if __name__ == '__main__':
    # Ejecutar en modo debug para desarrollo local
    app.run(debug=True, host='0.0.0.0', port=5000)