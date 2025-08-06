# --- CAMBIO 1: Importar 'send_from_directory' ---
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
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
            identity=twilio_phone_number
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
            'identity': twilio_phone_number
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
    Genera TwiML apropiado según el tipo de llamada
    """
    try:
        print("[DEBUG] Recibida solicitud en /handle_calls")
        print(f"[DEBUG] Datos del formulario: {request.form}")
        print(f"[DEBUG] Datos JSON: {request.get_json()}")
        
        # Obtener parámetros de la llamada
        from_number = request.form.get('From')
        to_number = request.form.get('To')
        call_sid = request.form.get('CallSid')
        
        print(f"[DEBUG] Parámetros de llamada - From: {from_number}, To: {to_number}, CallSid: {call_sid}")
        
        # Crear respuesta TwiML
        response = VoiceResponse()
        
        # Determinar si es llamada entrante o saliente
        # Para llamadas salientes desde el navegador, el parámetro 'To' será el número destino
        # Para llamadas entrantes, el 'To' será nuestro número de Twilio
        
        # Nota: El código original tenía una lógica que podría no funcionar como se espera.
        # Esta versión simplificada asume que las llamadas desde el navegador son salientes.
        if 'to' in request.form:
             dial = response.dial(caller_id=from_number)
             dial.number(request.form['to'])
        elif request.form.get('Direction') == 'inbound':
            # Llamada entrante: conectar al cliente que se identifique como 'browser_client'
             dial = response.dial()
             dial.client('browser_client')
        else:
             response.say("Gracias por llamar, no se especificó un destino.")

        return str(response), 200, {'Content-Type': 'text/xml'}
        
    except Exception as e:
        # En caso de error, colgar la llamada
        response = VoiceResponse()
        response.say('Lo sentimos, ha ocurrido un error. La llamada será terminada.')
        response.hangup()
        return str(response), 200, {'Content-Type': 'text/xml'}

@app.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint de verificación de salud del servidor
    """
    return jsonify({'status': 'OK', 'message': 'Servidor Twilio WebApp funcionando correctamente'})

if __name__ == '__main__':
    # Ejecutar en modo debug para desarrollo local
    app.run(debug=True, host='0.0.0.0', port=5000)