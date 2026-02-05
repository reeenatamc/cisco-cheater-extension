// const serverURL = "https://cisco-cheater-production-2079.up.railway.app";
// const serverURL = "https://cisco-cheater.onrender.com";
// const serverURL = "http://104.248.177.44";

const serverURL = "https://web-production-372a7.up.railway.app";

let popupActivo = null;

// Flag para el modo de captura
let modoCaptura = false;

// Escuchar mensajes del background (para captura por atajo de teclado)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showCaptureOverlay' && request.imageData) {
        mostrarSelectorArea(request.imageData);
    }
});

// Función para generar un ID único del dispositivo
function generateDeviceId() {
  return new Promise((resolve) => {
      chrome.storage.local.get(['deviceId'], function(result) {
          let deviceId = result.deviceId;
          if (!deviceId) {
              deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                  const r = Math.random() * 16 | 0;
                  const v = c === 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
              });
              chrome.storage.local.set({ deviceId: deviceId });
          }
          resolve(deviceId);
      });
  });
}

// Función para verificar la activación
async function checkActivation() {
  const deviceId = await generateDeviceId();
  try {
      const response = await fetch(`${serverURL}/verify_activation/`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ device_id: deviceId })
      });
      
      const text = await response.text();
      try {
          const data = JSON.parse(text);
          return data.is_activated;
      } catch (e) {
          console.error('Respuesta no es JSON:', text.substring(0, 100));
          return false;
      }
  } catch (error) {
      console.error('Error verificando activación:', error);
      return false;
  }
}

// Función para activar la extensión
async function activateExtension(key, geminiApiKey) {
  const deviceId = await generateDeviceId();
  try {
      const response = await fetch(`${serverURL}/activate/`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ 
              key: key,
              device_id: deviceId 
          })
      });
      
      const text = await response.text();
      let data;
      try {
          data = JSON.parse(text);
      } catch (e) {
          console.error('Respuesta no es JSON:', text.substring(0, 200));
          return { success: false, message: 'Error del servidor (respuesta inválida)' };
      }
      
      if (response.ok) {
          chrome.storage.local.set({ 
              isActivated: true,
              geminiApiKey: geminiApiKey 
          });
          return { success: true, message: data.message };
      } else {
          console.error('Server response:', data);
          return { success: false, message: data.error || 'Error desconocido del servidor' };
      }
  } catch (error) {
      console.error('Error completo:', error);
      return { success: false, message: `Error al conectar con el servidor: ${error.message}` };
  }
}

// Función para mostrar selector de área con imagen ya capturada (desde atajo de teclado)
function mostrarSelectorArea(imageData) {
    modoCaptura = true;
    
    // Crear overlay con la imagen capturada de fondo
    const overlay = document.createElement('div');
    overlay.id = 'capturaOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        cursor: crosshair;
        z-index: 99999;
    `;
    
    // Crear elemento para mostrar selección
    const seleccion = document.createElement('div');
    seleccion.id = 'capturaSeleccion';
    seleccion.style.cssText = `
        position: fixed;
        border: 2px dashed #fff;
        background: rgba(255,255,255,0.1);
        display: none;
        z-index: 100000;
        pointer-events: none;
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(seleccion);
    
    let startX, startY, isDrawing = false;
    
    overlay.addEventListener('mousedown', (e) => {
        isDrawing = true;
        startX = e.clientX;
        startY = e.clientY;
        seleccion.style.left = startX + 'px';
        seleccion.style.top = startY + 'px';
        seleccion.style.width = '0';
        seleccion.style.height = '0';
        seleccion.style.display = 'block';
    });
    
    overlay.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        
        seleccion.style.left = left + 'px';
        seleccion.style.top = top + 'px';
        seleccion.style.width = width + 'px';
        seleccion.style.height = height + 'px';
    });
    
    overlay.addEventListener('mouseup', async (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        
        const rect = seleccion.getBoundingClientRect();
        
        // Limpiar overlay
        overlay.remove();
        seleccion.remove();
        modoCaptura = false;
        
        if (rect.width < 10 || rect.height < 10) {
            return; // Selección muy pequeña
        }
        
        // Mostrar loading
        mostrarRespuesta('Procesando...', true);
        
        try {
            // Recortar la imagen ya capturada
            const imagenRecortada = await recortarImagen(
                imageData, 
                rect.left, 
                rect.top, 
                rect.width, 
                rect.height,
                window.devicePixelRatio || 1
            );
            
            // Enviar a Gemini
            await enviarImagenAGemini(imagenRecortada);
        } catch (error) {
            console.error('Error procesando imagen:', error);
            mostrarRespuesta('Error: ' + error.message, true);
        }
    });
    
    // Cancelar con ESC
    const cancelar = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            seleccion.remove();
            modoCaptura = false;
            document.removeEventListener('keydown', cancelar);
        }
    };
    document.addEventListener('keydown', cancelar);
}

// Función para recortar imagen
async function recortarImagen(imageData, x, y, width, height, dpr) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(
                img,
                x * dpr, y * dpr, width * dpr, height * dpr,
                0, 0, width * dpr, height * dpr
            );
            
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = imageData;
    });
}

// Función para enviar imagen a Gemini
async function enviarImagenAGemini(imagenBase64) {
    const deviceId = await generateDeviceId();
    
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async function(result) {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                mostrarRespuesta('API key no configurada', true);
                resolve();
                return;
            }
            
            try {
                const response = await fetch(`${serverURL}/consultar_gemini_imagen/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        imagen: imagenBase64,
                        api_key: apiKey,
                        device_id: deviceId
                    })
                });
                
                const text = await response.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    mostrarRespuesta('Error del servidor', true);
                    resolve();
                    return;
                }
                
                if (data.success) {
                    // Mostrar respuesta de Gemini
                    if (popupActivo) popupActivo.remove();
                    
                    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const box = document.createElement("div");
                    box.innerHTML = `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><strong>servidor</strong></div>${data.respuesta}`;
                    box.style.cssText = `
                        position: fixed;
                        bottom: 16px;
                        left: 16px;
                        padding: 4px 8px;
                        border-radius: 4px;
                        z-index: 9999;
                        font-family: 'Segoe UI', Arial, sans-serif;
                        font-size: 8px;
                        max-width: 200px;
                        backdrop-filter: blur(2px);
                        transition: opacity 0.3s ease, background-color 0.3s ease, color 0.3s ease;
                        opacity: 0.3;
                        cursor: pointer;
                    `;
                    
                    // Estilos iniciales opacos
                    if (isDarkMode) {
                        box.style.backgroundColor = "rgba(30, 30, 30, 0.1)";
                        box.style.color = "rgba(255, 255, 255, 0.3)";
                    } else {
                        box.style.backgroundColor = "rgba(240, 240, 240, 0.1)";
                        box.style.color = "rgba(0, 0, 0, 0.3)";
                    }
                    
                    document.body.appendChild(box);
                    popupActivo = box;
                    
                    // Manejo de clicks sobre el popup
                    let activo = false;
                    box.addEventListener("click", (e) => {
                        e.stopPropagation();
                        if (!activo) {
                            // Hacer más claro
                            box.style.backgroundColor = isDarkMode ? "rgba(30,30,30,0.9)" : "rgba(240,240,240,0.9)";
                            box.style.color = isDarkMode ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
                            box.style.opacity = "1";
                        } else {
                            // Volver al estado original
                            box.style.backgroundColor = isDarkMode ? "rgba(30,30,30,0.1)" : "rgba(240,240,240,0.1)";
                            box.style.color = isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
                            box.style.opacity = "0.3";
                        }
                        activo = !activo;
                    });
                    
                    // Click afuera del popup
                    const clickFuera = (e) => {
                        if (!box.contains(e.target)) {
                            box.remove();
                            popupActivo = null;
                            document.removeEventListener("click", clickFuera);
                        }
                    };
                    document.addEventListener("click", clickFuera);
                } else {
                    mostrarRespuesta(data.error || 'Error', true);
                }
                resolve();
            } catch (error) {
                mostrarRespuesta('Error: ' + error.message, true);
                resolve();
            }
        });
    });
}

// Función para consultar Gemini cuando no se encuentra la pregunta
async function consultarGemini(pregunta) {
    const deviceId = await generateDeviceId();
    
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async function(result) {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                resolve({ success: false, message: 'API key de Gemini no configurada' });
                return;
            }
            
            try {
                const response = await fetch(`${serverURL}/consultar_gemini/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        pregunta: pregunta,
                        api_key: apiKey,
                        device_id: deviceId
                    })
                });
                
                const text = await response.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error('Respuesta no es JSON:', text.substring(0, 200));
                    resolve({ success: false, message: 'Error del servidor' });
                    return;
                }
                
                if (data.success) {
                    resolve({ success: true, message: data.respuesta });
                } else {
                    resolve({ success: false, message: data.error || 'Sin respuesta de Gemini' });
                }
            } catch (error) {
                console.error('Error consultando Gemini:', error);
                resolve({ success: false, message: `Error: ${error.message}` });
            }
        });
    });
}

// Función para mostrar el diálogo de activación
function showActivationDialog() {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: #f0f0f0;
      padding: 12px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      color: #333;
      font-family: 'Segoe UI', Arial, sans-serif;
      border: 1px solid #ccc;
      max-width: 280px;
      font-size: 12px;
  `;
  
  dialog.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 16px; height: 16px; background: #0078d7; margin-right: 8px; border-radius: 2px;"></div>
          <h3 style="margin: 0; font-size: 12px; font-weight: normal;">Configuración inicial</h3>
      </div>
      <label style="font-size: 11px; color: #555;">Clave de activación:</label>
      <input type="password" id="activationKey" placeholder="Ingrese la clave" 
             style="width: 100%; padding: 4px; margin: 4px 0 8px 0; border: 1px solid #ccc; 
                    font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; box-sizing: border-box;">
      <label style="font-size: 11px; color: #555;">API Key de Gemini (opcional):</label>
      <input type="password" id="geminiApiKey" placeholder="Para consultas en internet" 
             style="width: 100%; padding: 4px; margin: 4px 0; border: 1px solid #ccc; 
                    font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; box-sizing: border-box;">
      <p style="margin: 2px 0 8px 0; font-size: 10px; color: #888;">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #0078d7;">Obtener API key gratis</a>
      </p>
      <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button id="activateBtn" style="padding: 4px 12px; background: #f0f0f0; 
                                         color: #333; border: 1px solid #ccc; border-radius: 2px; 
                                         cursor: pointer; font-family: 'Segoe UI', Arial, sans-serif; 
                                         font-size: 12px;">
              Aceptar
          </button>
      </div>
      <p id="activationMessage" style="margin: 8px 0 0 0; color: #666; font-size: 11px;"></p>
  `;
  
  document.body.appendChild(dialog);
  
  const activateBtn = dialog.querySelector('#activateBtn');
  const activationKey = dialog.querySelector('#activationKey');
  const geminiApiKeyInput = dialog.querySelector('#geminiApiKey');
  const messageEl = dialog.querySelector('#activationMessage');
  
  activateBtn.onclick = async () => {
      const result = await activateExtension(activationKey.value, geminiApiKeyInput.value);
      messageEl.textContent = result.message;
      messageEl.style.color = result.success ? '#2e7d32' : '#c62828';
      
      if (result.success) {
          setTimeout(() => {
              dialog.remove();
              location.reload();
          }, 1500);
      }
  };
}

function mostrarRespuesta(respuesta, found = true, preguntaOriginal = null) {
  let box = document.createElement("div");
  
  // Detectar si el sistema está en modo oscuro
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (found && Array.isArray(respuesta)) {
    box.innerHTML = `<strong>Opción ${respuesta[0]}</strong>:<br>${respuesta[1]}`;
  } else if (found) {
    box.innerText = respuesta;
  } else {
    // No encontrada - mostrar botones para consultar
    const iconColor = isDarkMode ? '#aaa' : '#555';
    box.innerHTML = `
      <span style="display: inline-flex; align-items: center; margin-right: 6px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>
      <button id="consultarGeminiBtn" style="
        padding: 3px 6px; 
        cursor: pointer; 
        background: ${isDarkMode ? 'rgba(50,50,50,0.8)' : 'rgba(220,220,220,0.8)'}; 
        border: 1px solid ${isDarkMode ? '#444' : '#bbb'}; 
        border-radius: 4px;
        color: inherit;
        margin-right: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
      <span style="font-size:9px;opacity:0.7;margin-left:2px;">Alt+.</span>
    `;
  }

  // Estilos base
  box.style.position = "fixed";
  box.style.bottom = "16px";
  box.style.left = "16px";
  box.style.padding = "3px 6px";
  box.style.borderRadius = "4px";
  box.style.zIndex = "9999";
  box.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  box.style.fontSize = "8px";
  box.style.maxWidth = "180px";
  box.style.backdropFilter = "blur(2px)";
  box.style.transition = "opacity 0.3s ease, background-color 0.3s ease, color 0.3s ease";
  box.style.opacity = "0.3"; // opacidad inicial baja
  box.style.cursor = "pointer";

  if (isDarkMode) {
    box.style.backgroundColor = "rgba(30, 30, 30, 0.1)";
    box.style.color = "rgba(255, 255, 255, 0.3)";
  } else {
    box.style.backgroundColor = "rgba(240, 240, 240, 0.1)";
    box.style.color = "rgba(0, 0, 0, 0.3)";
  }

  // Remover popup anterior si existe
  if (popupActivo) {
      popupActivo.remove();
  }
  
  document.body.appendChild(box);
  popupActivo = box;

  // Si no se encontró, agregar eventos a los botones
  if (!found && preguntaOriginal) {
    // Botón de consultar con texto (ojo)
    const geminiBtn = box.querySelector('#consultarGeminiBtn');
    if (geminiBtn) {
      geminiBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        geminiBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"><animate attributeName="stroke-dashoffset" dur="1s" values="32;0" repeatCount="indefinite"/></circle></svg>';
        geminiBtn.disabled = true;
        
        const resultado = await consultarGemini(preguntaOriginal);
        
        if (resultado.success) {
          box.innerHTML = `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><strong>servidor</strong></div>${resultado.message}`;
          // Mantener opacidad inicial baja
          box.style.backgroundColor = isDarkMode ? "rgba(30, 30, 30, 0.1)" : "rgba(240, 240, 240, 0.1)";
          box.style.color = isDarkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";
          box.style.opacity = "0.3";
          box.style.maxWidth = "200px";
        } else {
          geminiBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e55" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        }
      });
    }
    
  }

  // Manejo de clicks sobre el popup
  let activo = false;
  box.addEventListener("click", (e) => {
    // No hacer toggle si se clickeó el botón
    if (e.target.id === 'consultarGeminiBtn') return;
    
    e.stopPropagation(); // Evita que el click se propague al body
    if (!activo) {
      // Hacer más claro
      box.style.backgroundColor = isDarkMode ? "rgba(30,30,30,0.9)" : "rgba(240,240,240,0.9)";
      box.style.color = isDarkMode ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
      box.style.opacity = "1";
    } else {
      // Volver al estado original
      box.style.backgroundColor = isDarkMode ? "rgba(30,30,30,0.1)" : "rgba(240,240,240,0.1)";
      box.style.color = isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
      box.style.opacity = "0.3";
    }
    activo = !activo;
  });

  // Click afuera del popup
  const clickFuera = (e) => {
    if (!box.contains(e.target)) {
      box.remove();
      popupActivo = null;
      document.removeEventListener("click", clickFuera);
    }
  };
  document.addEventListener("click", clickFuera);
}


// Inicialización
async function initialize() {
  return new Promise((resolve) => {
      chrome.storage.local.get(['isActivated'], async function(result) {
          const isActivated = result.isActivated === true;
          const deviceId = await generateDeviceId();
          
          // Agregar estilo para hacer la selección transparente
          const style = document.createElement('style');
          style.textContent = `
              ::selection {
                  background: transparent;
                  color: inherit;
              }
              ::-moz-selection {
                  background: transparent;
                  color: inherit;
              }
          `;
          document.head.appendChild(style);
          
          if (!isActivated) {
              const isActuallyActivated = await checkActivation();
              if (!isActuallyActivated) {
                  showActivationDialog();
                  return;
              }
              chrome.storage.local.set({ isActivated: true });
          }
          
          // Tu código original del event listener
          document.addEventListener("mouseup", async (e) => {
              // Ignorar si está en modo captura
              if (modoCaptura) {
                  return;
              }
              
              // Ignorar si el click fue dentro de un popup activo
              if (popupActivo && popupActivo.contains(e.target)) {
                  return;
              }
              
              const seleccion = window.getSelection().toString().trim();
              if (seleccion.length > 0) {
                  try {
                      await navigator.clipboard.writeText(seleccion);
                      const response = await fetch(`${serverURL}/buscar/`, {
                          method: "POST",
                          headers: {
                              "Content-Type": "application/json",
                              "X-Requested-With": "XMLHttpRequest"
                          },
                          body: JSON.stringify({ 
                              pregunta: seleccion,
                              device_id: deviceId
                          })
                      });
                      
                      if (response.status === 403) {
                          chrome.storage.local.remove('isActivated');
                          location.reload();
                          return;
                      }
                      
                      const text = await response.text();
                      let data;
                      try {
                          data = JSON.parse(text);
                      } catch (e) {
                          console.error('Respuesta no es JSON:', text.substring(0, 200));
                          mostrarRespuesta("Error del servidor", true);
                          return;
                      }
                      mostrarRespuesta(data.respuesta, data.found, seleccion);
                  } catch (err) {
                      console.error("Error:", err);
                      mostrarRespuesta("Error al consultar el servidor.", true);
                  }
              }
          });
          resolve();
      });
  });
}

// Iniciar la extensión
initialize();