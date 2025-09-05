/**
 * Maximum Fix - Diagnóstico y Corrección del Módulo SMS
 * Script para diagnosticar y resolver problemas de conexión SMS
 * NO utiliza credenciales hardcodeadas - requiere credenciales reales del usuario
 */

const { chromium } = require('playwright');

async function fixSmsCredentials() {
    console.log('🔧 Maximum Fix - Diagnóstico del Módulo SMS');
    console.log('===============================================');
    console.log('⚠️  IMPORTANTE: Este script NO configura credenciales automáticamente.');
    console.log('   Debe ingresar credenciales REALES de Twilio a través de la interfaz.');
    console.log('');
    
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
        
        // Paso 3: Verificar estado actual de credenciales
        console.log('📍 Paso 3: Verificando estado de credenciales');
        
        const credentialsStatus = await page.evaluate(() => {
            const fields = {
                accountSid: document.getElementById('accountSid')?.value || '',
                authToken: document.getElementById('authToken')?.value || '',
                apiKeySid: document.getElementById('apiKeySid')?.value || '',
                apiKeySecret: document.getElementById('apiKeySecret')?.value || '',
                twimlAppSid: document.getElementById('twimlAppSid')?.value || '',
                twilioPhoneNumber: document.getElementById('twilioPhoneNumber')?.value || ''
            };
            
            const hasCredentials = Object.values(fields).some(value => value.trim() !== '');
            const allFieldsFilled = Object.values(fields).every(value => value.trim() !== '');
            
            return {
                fields,
                hasCredentials,
                allFieldsFilled,
                savedCredentials: window.twilioCredentials ? window.twilioCredentials.load() : null
            };
        });
        
        console.log('📊 Estado de credenciales:');
        console.log(`   - Campos con datos: ${credentialsStatus.hasCredentials ? 'Sí' : 'No'}`);
        console.log(`   - Todos los campos completos: ${credentialsStatus.allFieldsFilled ? 'Sí' : 'No'}`);
        console.log(`   - Credenciales guardadas: ${credentialsStatus.savedCredentials ? 'Sí' : 'No'}`);
        
        if (!credentialsStatus.allFieldsFilled) {
            console.log('');
            console.log('❌ PROBLEMA IDENTIFICADO: Credenciales incompletas');
            console.log('   Las credenciales de Twilio no están configuradas correctamente.');
            console.log('');
            console.log('🔧 SOLUCIÓN REQUERIDA:');
            console.log('   1. Obtenga credenciales REALES de su cuenta de Twilio:');
            console.log('      - Account SID (comienza con AC)');
            console.log('      - Auth Token');
            console.log('      - API Key SID (comienza con SK)');
            console.log('      - API Key Secret');
            console.log('      - TwiML App SID (comienza con AP)');
            console.log('      - Número de teléfono de Twilio (formato +1234567890)');
            console.log('');
            console.log('   2. Ingrese estas credenciales en los campos correspondientes');
            console.log('   3. Haga clic en "Guardar" para almacenar las credenciales');
            console.log('   4. Active el checkbox "Conectar" para establecer la conexión');
            console.log('');
            console.log('⚠️  NOTA: Las credenciales de prueba NO funcionarán con Twilio real.');
            console.log('');
            
            // Resaltar campos vacíos
            await page.evaluate(() => {
                const fields = ['accountSid', 'authToken', 'apiKeySid', 'apiKeySecret', 'twimlAppSid', 'twilioPhoneNumber'];
                fields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field && field.value.trim() === '') {
                        field.style.border = '2px solid #ff6b6b';
                        field.style.backgroundColor = '#ffe0e0';
                    }
                });
            });
            
            console.log('🔍 Manteniendo navegador abierto para que pueda ingresar credenciales...');
            console.log('   Los campos vacíos están resaltados en rojo.');
            console.log('   Presione Ctrl+C cuando termine de configurar las credenciales.');
            
            // Esperar indefinidamente para que el usuario configure las credenciales
            await new Promise(() => {});
            return;
        }
        
        // Paso 4: Verificar validez de credenciales
        console.log('📍 Paso 4: Validando formato de credenciales');
        
        const validationResult = await page.evaluate(() => {
            if (window.twilioCredentials) {
                const credentials = {
                    accountSid: document.getElementById('accountSid')?.value || '',
                    authToken: document.getElementById('authToken')?.value || '',
                    apiKeySid: document.getElementById('apiKeySid')?.value || '',
                    apiKeySecret: document.getElementById('apiKeySecret')?.value || '',
                    twimlAppSid: document.getElementById('twimlAppSid')?.value || '',
                    twilioPhoneNumber: document.getElementById('twilioPhoneNumber')?.value || ''
                };
                
                return window.twilioCredentials.validate(credentials);
            }
            return { valid: false, errors: ['Módulo de credenciales no disponible'] };
        });
        
        if (!validationResult.valid) {
            console.log('❌ PROBLEMA: Formato de credenciales inválido');
            console.log('   Errores encontrados:');
            validationResult.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
            console.log('');
            console.log('🔧 CORRIJA los errores de formato y ejecute el script nuevamente.');
            
            await new Promise(() => {});
            return;
        }
        
        console.log('✅ Formato de credenciales válido');
        
        // Paso 5: Guardar credenciales si no están guardadas
        console.log('📍 Paso 5: Verificando credenciales guardadas');
        
        if (!credentialsStatus.savedCredentials) {
            console.log('💾 Guardando credenciales...');
            
            try {
                await page.click('#saveCredentialsBtn');
                await page.waitForTimeout(2000);
                console.log('✅ Credenciales guardadas');
            } catch (error) {
                console.log('⚠️  Botón de guardar no encontrado, guardando via JavaScript...');
                
                await page.evaluate(() => {
                    if (window.twilioCredentials) {
                        const credentials = {
                            accountSid: document.getElementById('accountSid')?.value || '',
                            authToken: document.getElementById('authToken')?.value || '',
                            apiKeySid: document.getElementById('apiKeySid')?.value || '',
                            apiKeySecret: document.getElementById('apiKeySecret')?.value || '',
                            twimlAppSid: document.getElementById('twimlAppSid')?.value || '',
                            twilioPhoneNumber: document.getElementById('twilioPhoneNumber')?.value || ''
                        };
                        
                        try {
                            window.twilioCredentials.save(credentials);
                            console.log('Credenciales guardadas via JavaScript');
                        } catch (e) {
                            console.error('Error guardando credenciales:', e);
                        }
                    }
                });
            }
        } else {
            console.log('✅ Credenciales ya están guardadas');
        }
        
        // Paso 6: Intentar conexión
        console.log('📍 Paso 6: Iniciando conexión Twilio');
        
        try {
            await page.waitForSelector('#connectionToggle', { timeout: 5000 });
            
            // Verificar si ya está conectado
            const isConnected = await page.evaluate(() => {
                return window.twilioPhone ? window.twilioPhone.isConnected : false;
            });
            
            if (!isConnected) {
                await page.click('#connectionToggle');
                await page.waitForTimeout(5000);
                console.log('🔄 Conexión iniciada, esperando resultado...');
            } else {
                console.log('✅ Ya está conectado');
            }
        } catch (error) {
            console.log('⚠️  Botón de conexión no encontrado, intentando método alternativo...');
            
            await page.evaluate(() => {
                if (window.twilioPhone && typeof window.twilioPhone.connect === 'function') {
                    window.twilioPhone.connect();
                    console.log('Conexión iniciada via JavaScript');
                }
            });
        }
        
        // Paso 7: Verificar estado de conexión
        console.log('📍 Paso 7: Verificando estado de conexión');
        await page.waitForTimeout(8000); // Dar tiempo para que se establezca la conexión
        
        const connectionStatus = await page.evaluate(() => {
            return {
                phoneConnected: window.twilioPhone ? window.twilioPhone.isConnected : false,
                phoneStatus: window.twilioPhone ? window.twilioPhone.currentStatus : 'Desconocido',
                hasCredentials: window.twilioCredentials ? window.twilioCredentials.load() !== null : false
            };
        });
        
        console.log('📊 Estado de conexión:', connectionStatus);
        
        // Paso 8: Navegar al tab de SMS y verificar funcionalidad
        console.log('📍 Paso 8: Verificando funcionalidad SMS');
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
                buttonDisabled: newSmsBtn ? newSmsBtn.disabled : true,
                smsModuleLoaded: window.twilioSMS !== undefined
            };
        });
        
        console.log('📱 Estado SMS:', smsStatus);
        
        // Paso 9: Probar funcionalidad del botón
        if (smsStatus.buttonExists && !smsStatus.buttonDisabled) {
            console.log('📍 Paso 9: Probando botón de nuevo SMS');
            try {
                await page.click('#newSmsBtn');
                await page.waitForTimeout(2000);
                
                // Verificar si se abrió el modal o SweetAlert
                const modalOpened = await page.evaluate(() => {
                    // Verificar modal Bootstrap
                    const modals = document.querySelectorAll('.modal.show');
                    // Verificar SweetAlert
                    const swalModal = document.querySelector('.swal2-container');
                    
                    return modals.length > 0 || swalModal !== null;
                });
                
                if (modalOpened) {
                    console.log('✅ Modal de nuevo SMS abierto correctamente');
                } else {
                    console.log('⚠️  Modal no se abrió, pero el botón respondió');
                }
            } catch (error) {
                console.log('❌ Error al hacer clic en el botón:', error.message);
            }
        } else {
            console.log('❌ Botón SMS no disponible o deshabilitado');
        }
        
        // Paso 10: Diagnóstico final
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
                successes.push('Credenciales configuradas y guardadas');
            } else {
                issues.push('Credenciales no configuradas o no guardadas');
            }
            
            // Verificar conexión
            if (window.twilioPhone && window.twilioPhone.isConnected) {
                successes.push('Twilio Phone conectado exitosamente');
            } else {
                issues.push('Twilio Phone no conectado - verifique credenciales');
            }
            
            // Verificar elementos UI
            const smsBtn = document.getElementById('newSmsBtn');
            if (smsBtn && !smsBtn.disabled) {
                successes.push('Botón SMS funcional y habilitado');
            } else {
                issues.push('Botón SMS no funcional o deshabilitado');
            }
            
            return { issues, successes };
        });
        
        if (finalStatus.successes.length > 0) {
            console.log('✅ ELEMENTOS FUNCIONANDO CORRECTAMENTE:');
            finalStatus.successes.forEach((success, index) => {
                console.log(`   ${index + 1}. ${success}`);
            });
        }
        
        if (finalStatus.issues.length > 0) {
            console.log('\n❌ PROBLEMAS IDENTIFICADOS:');
            finalStatus.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
            
            console.log('\n🔧 RECOMENDACIONES:');
            if (finalStatus.issues.some(issue => issue.includes('credenciales'))) {
                console.log('   • Verifique que las credenciales de Twilio sean REALES y válidas');
                console.log('   • Asegúrese de que la cuenta de Twilio esté activa y tenga saldo');
                console.log('   • Verifique que el TwiML App esté configurado correctamente');
            }
            if (finalStatus.issues.some(issue => issue.includes('conectado'))) {
                console.log('   • Revise la consola del navegador para errores de conexión');
                console.log('   • Verifique la conectividad de red');
                console.log('   • Confirme que el backend esté ejecutándose correctamente');
            }
        }
        
        if (finalStatus.issues.length === 0) {
            console.log('\n🎉 ¡DIAGNÓSTICO EXITOSO! El módulo SMS está completamente funcional.');
            console.log('   Puede proceder a enviar mensajes SMS.');
        } else {
            console.log('\n⚠️  Se requieren correcciones adicionales antes de usar SMS.');
        }
        
        // Mantener navegador abierto para verificación
        console.log('\n🔍 Manteniendo navegador abierto para verificación manual...');
        console.log('   Pruebe la funcionalidad SMS manualmente.');
        console.log('   Presione Ctrl+C para cerrar cuando termine la verificación.');
        
        // Esperar indefinidamente
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error durante el diagnóstico:', error);
        console.log('\n🔧 SOLUCIÓN SUGERIDA:');
        console.log('   1. Verifique que el servidor frontend esté ejecutándose en localhost:8000');
        console.log('   2. Verifique que el servidor backend esté ejecutándose correctamente');
        console.log('   3. Asegúrese de que las credenciales de Twilio sean válidas');
    }
}

// Ejecutar diagnóstico
fixSmsCredentials().catch(console.error);