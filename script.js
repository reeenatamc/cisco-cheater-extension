// const serverURL = "http://localhost:8000";
const serverURL = "https://cisco-cheater.onrender.com";


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
          },
          body: JSON.stringify({ device_id: deviceId })
      });
      const data = await response.json();
      return data.is_activated;
  } catch (error) {
      console.error('Error verificando activación:', error);
      return false;
  }
}

// Función para activar la extensión
async function activateExtension(key) {
  const deviceId = await generateDeviceId();
  try {
      const response = await fetch(`${serverURL}/activate/`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
              key: key,
              device_id: deviceId 
          })
      });
      const data = await response.json();
      if (response.ok) {
          chrome.storage.local.set({ isActivated: true });
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
          <h3 style="margin: 0; font-size: 12px; font-weight: normal;">Clave para gestor de certificados</h3>
      </div>
      <input type="password" id="activationKey" placeholder="Ingrese la clave" 
             style="width: 100%; padding: 4px; margin: 4px 0; border: 1px solid #ccc; 
                    font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px;">
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
  const messageEl = dialog.querySelector('#activationMessage');
  
  activateBtn.onclick = async () => {
      const result = await activateExtension(activationKey.value);
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

function mostrarRespuesta(respuesta) {
  let box = document.createElement("div");
  
  // Detectar si el sistema está en modo oscuro
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (Array.isArray(respuesta)) {
    box.innerHTML = `<strong>Opción ${respuesta[0]}</strong>:<br>${respuesta[1]}`;
  } else {
    box.innerText = respuesta;
  }

  // Estilos base
  box.style.position = "fixed";
  box.style.bottom = "16px";
  box.style.left = "16px";
  box.style.transform = "none";
  box.style.padding = "3px 6px";
  box.style.borderRadius = "4px";
  box.style.zIndex = "9999";
  box.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  box.style.fontSize = "8px";
  box.style.maxWidth = "180px";
  box.style.backdropFilter = "blur(2px)";
  box.style.transition = "opacity 0.5s ease";
  box.style.opacity = "0";
  box.style.border = "none";
  box.style.boxShadow = "none";

  // Estilos específicos según el modo
  if (isDarkMode) {
    box.style.backgroundColor = "rgba(30, 30, 30, 0.1)";
    box.style.color = "rgba(255, 255, 255, 0.3)";
  } else {
    box.style.backgroundColor = "rgba(240, 240, 240, 0.1)";
    box.style.color = "rgba(0, 0, 0, 0.3)";
  }

  document.body.appendChild(box);
  requestAnimationFrame(() => { box.style.opacity = "1"; });

  setTimeout(() => {
    box.style.opacity = "0";
    setTimeout(() => box.remove(), 500);
  }, 4000);
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
          document.addEventListener("mouseup", async () => {
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
                      
                      const data = await response.json();
                      mostrarRespuesta(data.respuesta);
                  } catch (err) {
                      console.error("Error:", err);
                      mostrarRespuesta("❌ Error al consultar el servidor.");
                  }
              }
          });
          resolve();
      });
  });
}

// Iniciar la extensión
initialize();