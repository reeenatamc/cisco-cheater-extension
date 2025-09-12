# Cisco Helper

Extensión de navegador que consulta automáticamente texto seleccionado al servidor Django y muestra la respuesta en un popup discreto.

## 📦 Contenido

- `manifest.json`: Configura los permisos, dominios permitidos y el script.
- `script.js`: Escucha la selección de texto, lo copia y consulta a un servidor.

## ⚙️ Instalación

1. Clona o descarga esta carpeta.
2. Abre `chrome://extensions/` o `edge://extensions/`.
3. Activa el **modo desarrollador**.
4. Haz clic en **"Cargar descomprimida"** y selecciona la carpeta del proyecto.

## 💡 Uso

- Selecciona texto en cualquier página permitida.
- Automáticamente se copia y se consulta al servidor.
- Se muestra un popup en la esquina inferior izquierda con la respuesta.

## 🧠 Requisitos

El servidor debe estar corriendo y responder con JSON:

```json
{ "respuesta": "Texto de respuesta" }
```

## 🔐 Permisos

La extensión usa:

* `clipboardRead`, `clipboardWrite`: para copiar el texto seleccionado.
* `<all_urls>` y URLs de NetAcad: para inyectar el script en las páginas deseadas.

## 📄 Licencia

MIT
