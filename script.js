const serverURL = "http://localhost:8000/buscar/";

function mostrarRespuesta(respuesta) {
  let box = document.createElement("div");

  if (Array.isArray(respuesta)) {
    box.innerHTML = `<strong>Opción ${respuesta[0]}</strong>:<br>${respuesta[1]}`;
  } else {
    box.innerText = respuesta;
  }

  box.style.position = "fixed";
  box.style.bottom = "16px";
  box.style.left = "16px";
  box.style.transform = "none";
  box.style.backgroundColor = "rgba(240, 240, 240, 0.15)";
  box.style.padding = "4px 8px";
  box.style.border = "1px solid rgba(170, 170, 170, 0.2)";
  box.style.borderRadius = "6px";
  box.style.zIndex = 9999;
  box.style.fontFamily = "'Roboto', Arial, sans-serif";
  box.style.fontSize = "9px";
  box.style.color = "rgba(0, 0, 0, 0.15)";
  box.style.maxWidth = "220px";
  box.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.05)";
  box.style.backdropFilter = "blur(2px)";
  box.style.transition = "opacity 0.5s ease";
  box.style.opacity = "0";



  document.body.appendChild(box);
  requestAnimationFrame(() => { box.style.opacity = "1"; });

  setTimeout(() => {
    box.style.opacity = "0";
    setTimeout(() => box.remove(), 500);
  }, 4000);
}

document.addEventListener("mouseup", () => {
  const seleccion = window.getSelection().toString().trim();
  if (seleccion.length > 0) {
    navigator.clipboard.writeText(seleccion).then(() => {
      fetch(serverURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ pregunta: seleccion })
      })
      .then(res => res.json())
      .then(data => mostrarRespuesta(data.respuesta))
      .catch(err => mostrarRespuesta("❌ Error al consultar el servidor."));
    }).catch(err => {
      console.error("Error copiando al portapapeles:", err);
      mostrarRespuesta("❌ No se pudo copiar el texto seleccionado.");
    });
  }
});
