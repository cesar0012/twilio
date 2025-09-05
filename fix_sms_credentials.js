/**
 * Maximum Fix - Configuración Automática de Credenciales SMS
 * Script para resolver el problema de conexión SMS configurando credenciales
 */

const { chromium } = require('playwright');

async function fixSmsCredentials() {
    console.log('🔧 Maximum Fix - Configuración Automática de Credenciales SMS');
    console.log('===========================================================');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500
    });
    
    const page = await browser.newPage();
    
    try {
        // Paso 1: Navegar a la aplicación
        console.log('📍 Paso 1: Navegando a localhost:8000');
        await page.goto('http://localhost:8000');
        await page.waitForTimeout(3000);
        
        // Paso 2: Navegar al tab de configuración
        console.log('📍 Paso 2: Navegando al tab de configuración');
        await page.waitForSelector('button[data-bs-target="#navs-pills-settings"]', { timeout: 10000 });
        await page.click('button[data-bs-target="#navs-pills-settings"]');
        await page.waitForTimeout(2000);
        
        // Paso 3: Configurar credenciales de Twilio
        console.log('📍 Paso 3: Configurando credenciales de Twilio');
        
        // Credenciales de Twilio proporcionadas
        const credentials = {
            accountSid: 'AC6f88e2c0b5c4b8e8c4e8c4e8c4e8c4e8',
            authToken: 'your_auth_token_here',
            apiKeySid: 'SK6f88e2c0b5c4b8e8c4e8c4e8c4e8c4e8',
            apiKeySecret: 'your_api_key_secret_here',
            twimlAppSid: 'AP6f88e2c0b5c4b8e8c4e8c4e8c4e8c4e8',
            twilioPhoneNumber: '+18449282819'
        };
        
        // Llenar campos de credenciales
        const fields = [
            { id: 'accountSid', value: credentials.accountSid },
            { id: 'authToken', value: credentials.authToken },
            { id: 'apiKeySid', value: credentials.apiKeySid },
            { id: 'apiKeySecret', value: credentials.apiKeySecret },
            { id: 'twimlAppSid', value: credentials.twimlAppSid },
            { id: 'twilioPhoneNumber', value: credentials.twilioPhoneNumber }
        ];
        
        for (const field of fields) {
            try {
                await page.waitForSelector(`#${field.id}`, { timeout: 5000 });
                await page.fill(`#${field.id}`, field.value);
                console.log(`✅ Campo ${field.id} configurado`);
            } catch (error) {
                console.log(`⚠️  Campo ${field.id} no encontrado, continuando...`);
            }
        }
        
        // Paso 4: Guardar credenciales
        console.log('📍 Paso 4: Guardando credenciales');
        try {
            await page.waitForSelector('#saveCredentialsBtn', { timeout: 5000 });
            await page.click('#saveCredentialsBtn');
            await page.waitForTimeout(2000);
            console.log('✅ Credenciales guardadas');
        } catch (error) {
            console.log('⚠️  Botón de guardar no encontrado, intentando método alternativo...');
            
            // Método alternativo: usar JavaScript directo
            await page.evaluate((creds) => {
                if (window.twilioCredentials) {
                    try {
                        window.twilioCredentials.save(creds);
                        console.log('Credenciales guardadas via JavaScript');
                    } catch (e) {
                        console.error('Error guardando credenciales:', e);
                    }
                }
            }, credentials);
        }
        
        // Paso 5: Conectar Twilio
        console.log('📍 Paso 5: Iniciando conexión Twilio');
        try {
            await page.waitForSelector('#connectBtn', { timeout: 5000 });
            await page.click('#connectBtn');
            await page.waitForTimeout(3000);
            console.log('✅ Conexión iniciada');
        } catch (error) {
            console.log('⚠️  Botón de conexión no encontrado, intentando método alternativo...');
            
            // Método alternativo: conectar via JavaScript
            await page.evaluate(() => {
                if (window.twilioPhone && typeof window.twilioPhone.connect === 'function') {
                    window.twilioPhone.connect();
                    console.log('Conexión iniciada via JavaScript');
                }
            });
        }
        
        // Paso 6: Verificar estado de conexión
        console.log('📍 Paso 6: Verificando estado de conexión');
        await page.waitForTimeout(5000);
        
        const connectionStatus = await page.evaluate(() => {
            return {
                phoneConnected: window.twilioPhone ? window.twilioPhone.isConnected : false,
                phoneStatus: window.twilioPhone ? window.twilioPhone.currentStatus : 'Desconocido',
                hasCredentials: window.twilioCredentials ? window.twilioCredentials.load() !== null : false
            };
        });
        
        console.log('📊 Estado de conexión:', connectionStatus);
        
        // Paso 7: Navegar al tab de SMS y verificar funcionalidad
        console.log('📍 Paso 7: Verificando funcionalidad SMS');
        await page.waitForSelector('button[data-bs-target="#navs-pills-sms"]', { timeout: 5000 });
        await page.click('button[data-bs-target="#navs-pills-sms"]');
        await page.waitForTimeout(2000);
        
        // Verificar estado del SMS
        const smsStatus = await page.evaluate(() => {
            const statusElement = document.getElementById('smsStatusMessage');
            const newSmsBtn = document.getElementById('newSmsBtn');
            
            return {
                statusText: statusElement ? statusElement.textContent : 'No encontrado',
                buttonExists: newSmsBtn !== null,
                buttonDisabled: newSmsBtn ? newSmsBtn.disabled : true
            };
        });
        
        console.log('📱 Estado SMS:', smsStatus);
        
        // Paso 8: Probar funcionalidad del botón
        console.log('📍 Paso 8: Probando botón de nuevo SMS');
        try {
            await page.click('#newSmsBtn');
            await page.waitForTimeout(2000);
            
            // Verificar si se abrió el modal
            const modalOpened = await page.evaluate(() => {
                const modals = document.querySelectorAll('.modal.show');
                return modals.length > 0;
            });
            
            if (modalOpened) {
                console.log('✅ Modal de nuevo SMS abierto correctamente');
            } else {
                console.log('⚠️  Modal no se abrió, pero el botón respondió');
            }
        } catch (error) {
            console.log('❌ Error al hacer clic en el botón:', error.message);
        }
        
        // Paso 9: Diagnóstico final
        console.log('\n🔍 DIAGNÓSTICO FINAL:');
        console.log('=====================');
        
        const finalStatus = await page.evaluate(() => {
            const issues = [];
            const successes = [];
            
            // Verificar módulos
            if (window.twilioSMS) {
                successes.push('Módulo twilioSMS cargado correctamente');
            } else {
                issues.push('Módulo twilioSMS no cargado');
            }
            
            // Verificar credenciales
            if (window.twilioCredentials && window.twilioCredentials.load()) {
                successes.push('Credenciales configuradas');
            } else {
                issues.push('Credenciales no configuradas');
            }
            
            // Verificar conexión
            if (window.twilioPhone && window.twilioPhone.isConnected) {
                successes.push('Twilio Phone conectado');
            } else {
                issues.push('Twilio Phone no conectado');
            }
            
            // Verificar elementos UI
            const smsBtn = document.getElementById('newSmsBtn');
            if (smsBtn && !smsBtn.disabled) {
                successes.push('Botón SMS funcional');
            } else {
                issues.push('Botón SMS no funcional');
            }
            
            return { issues, successes };
        });
        
        if (finalStatus.successes.length > 0) {
            console.log('✅ CORRECCIONES EXITOSAS:');
            finalStatus.successes.forEach((success, index) => {
                console.log(`   ${index + 1}. ${success}`);
            });
        }
        
        if (finalStatus.issues.length > 0) {
            console.log('\n❌ PROBLEMAS RESTANTES:');
            finalStatus.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
        if (finalStatus.issues.length === 0) {
            console.log('\n🎉 ¡PROBLEMA RESUELTO! El módulo SMS está completamente funcional.');
        } else {
            console.log('\n⚠️  Se requieren correcciones adicionales.');
        }
        
        // Mantener navegador abierto para verificación
        console.log('\n🔍 Manteniendo navegador abierto para verificación manual...');
        console.log('Prueba hacer clic en el botón "Nuevo" en el tab SMS.');
        console.log('Presiona Ctrl+C para cerrar cuando termines la verificación.');
        
        // Esperar indefinidamente
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error durante la configuración:', error);
    }
}

// Ejecutar configuración
fixSmsCredentials().catch(console.error);