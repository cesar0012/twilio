from flask import Flask, request, jsonify
from flask_cors import CORS
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
import os

app = Flask(__name__)
CORS(app)  # Permitir CORS para comunicación frontend-backend

@app.route('/token', methods=['POST'])
def generate_token():
    """
    Genera un AccessToken de Twilio usando las credenciales enviadas desde el frontend
    """
    try:
        data = request.get_json()
        
        # Extraer credenciales del request
        account_sid = data.get('accountSid')
        api_key_sid = data.get('apiKeySid')
        api_key_secret = data.get('apiKeySecret')
        twiml_app_sid = data.get('twimlAppSid')
        twilio_phone_number = data.get('twilioPhoneNumber')
        
        # Validar que todas las credenciales estén presentes
        if not all([account_sid, api_key_sid, api_key_secret, twiml_app_sid, twilio_phone_number]):
            return jsonify({'error': 'Faltan credenciales requeridas'}), 400
        
        # Crear AccessToken
        token = AccessToken(
            account_sid,
            api_key_sid,
            api_key_secret,
            identity=twilio_phone_number
        )
        
        # Crear VoiceGrant
        voice_grant = VoiceGrant(
            outgoing_application_sid=twiml_app_sid,
            incoming_allow=True
        )
        
        # Agregar el grant al token
        token.add_grant(voice_grant)
        
        return jsonify({
            'token': token.to_jwt(),
            'identity': twilio_phone_number
        })
        
    except Exception as e:
        return jsonify({'error': f'Error generando token: {str(e)}'}), 500

@app.route('/handle_calls', methods=['POST'])
def handle_calls():
    """
    Webhook para manejar llamadas entrantes y salientes
    Genera TwiML apropiado según el tipo de llamada
    """
    try:
        # Obtener parámetros de la llamada
        from_number = request.form.get('From')
        to_number = request.form.get('To')
        call_sid = request.form.get('CallSid')
        
        # Crear respuesta TwiML
        response = VoiceResponse()
        
        # Determinar si es llamada entrante o saliente
        # Para llamadas salientes desde el navegador, el parámetro 'To' será el número destino
        # Para llamadas entrantes, el 'To' será nuestro número de Twilio
        
        if request.form.get('Direction') == 'inbound':
            # Llamada entrante: enrutar al cliente en el navegador
            dial = response.dial(caller_id=from_number)
            dial.client('browser_client')
        else:
            # Llamada saliente: marcar al número destino
            caller_id = request.form.get('CallerId', from_number)
            response.dial(to_number, caller_id=caller_id)
        
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
    # Ejecutar en modo debug para desarrollo
    app.run(debug=True, host='0.0.0.0', port=5000)