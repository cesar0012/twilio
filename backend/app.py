# --- CAMBIO 1: Importar 'send_from_directory' ---
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
from twilio.rest import Client as TwilioRestClient
import os

# --- CAMBIO CLAVE: Almacenamiento temporal de números de teléfono por cliente ---
# Esto es una solución simple para un solo usuario. Para múltiples usuarios concurrentes,
# se necesitaría un mecanismo más robusto como una base de datos o una caché (ej. Redis).
client_phone_numbers = {}

# --- CAMBIO 2: Configurar Flask para que sepa dónde está el frontend ---
# La ruta '../frontend' le dice a Flask que suba un nivel desde 'backend' y entre a 'frontend'
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # Permitir CORS para comunicación frontend-backend

# --- CAMBIO 3: Añadir la ruta principal para servir index.html ---
@app.route('/')
def serve_index():
    # Esta función sirve el archivo principal de tu frontend.
    return send_from_directory(app.static_folder, 'index.html')

# --- TU CÓDIGO EXISTENTE (CON CAMBIOS) ---

@app.route('/token', methods=['POST'])
def generate_token():
    """
    Genera un AccessToken de Twilio y guarda el número de teléfono del cliente.
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
        
        # --- CAMBIO CLAVE: Asociar el número de teléfono con la identidad del cliente ---
        identity = 'browser_client'
        client_phone_numbers[identity] = twilio_phone_number
        print(f"[DEBUG] Número {twilio_phone_number} asociado al cliente '{identity}'")

        print("[DEBUG] Creando AccessToken...")
        # Crear AccessToken
        token = AccessToken(
            account_sid,
            api_key_sid,
            api_key_secret,
            identity=identity
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
            'identity': identity
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
    Webhook para manejar llamadas. Usa el número guardado para llamadas salientes.
    """

    # --- PASO DE DEPURACIÓN MEJORADO ---
    print("\n--- INICIO DE WEBHOOK /handle_calls ---")
    all_params = request.form.to_dict()
    print(f"Parámetros recibidos de Twilio: {all_params}")
    print("--- FIN DE WEBHOOK ---\n")
    # ----------------------------------------

    response = VoiceResponse()
    try:
        to_param = request.form.get('To')
        from_param = request.form.get('From')

        if to_param and to_param.startswith('client:'):
            # Llamada ENTRANTE a un cliente específico.
            dial = response.dial()
            dial.client(to_param.split(':')[1])
        elif from_param and from_param.startswith('client:'):
            # Llamada SALIENTE desde un cliente.
            number_to_dial = to_param
            
            # --- CAMBIO CLAVE: Recuperar el callerId guardado ---
            client_identity = from_param.split(':')[1]
            caller_id = client_phone_numbers.get(client_identity)

            if not caller_id:
                print(f"[ERROR] No se encontró un número de teléfono para el cliente '{client_identity}'")
                response.say('Error de configuración: no se pudo encontrar el número de teléfono para este cliente.')
                response.hangup()
                return str(response), 200, {'Content-Type': 'text/xml'}

            print(f"[DEBUG] Usando callerId '{caller_id}' para la llamada saliente a '{number_to_dial}'")
            dial = response.dial(caller_id=caller_id)
            dial.number(number_to_dial)
        else:
            # Llamada entrante a un número de Twilio. Reenviar al cliente del navegador.
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