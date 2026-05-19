# 🔥 Cyber 2026 — Countdown GIF Server

Servidor en Node.js que genera **GIFs animados de countdown** en tiempo real. Cada vez que el email es abierto, el servidor calcula cuánto falta para el evento y devuelve un GIF con esa info animada.

**Funciona en Gmail, Outlook, Apple Mail y casi todos los clientes** — porque es solo una imagen.

---

## ⚙️ Cómo funciona

1. En tu email pones: `<img src="https://tu-servidor.com/countdown.gif" />`
2. Cuando el cliente de email carga la imagen, hace un GET al servidor
3. El servidor calcula la diferencia con la fecha del evento (1 Junio 2026)
4. Genera un GIF de 60 frames (60 segundos animados) y lo devuelve
5. Headers `Cache-Control: no-store` garantizan que cada apertura traiga un GIF fresco

---

## 🚀 Setup local

```bash
cd countdown-server
npm install
npm start
```

Luego abre:
- `http://localhost:3000/preview` → vista previa visual
- `http://localhost:3000/countdown.gif` → el GIF en bruto
- `http://localhost:3000/` → status JSON

> **Nota sobre `canvas`:** la librería `canvas` requiere dependencias de sistema. En Ubuntu/Debian:
> ```bash
> sudo apt-get install libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
> ```
> En Mac:
> ```bash
> brew install pkg-config cairo pango libpng jpeg giflib librsvg
> ```

---

## ☁️ Deploy en producción

### Opción 1: Railway (recomendado, gratis con límites)
1. Sube este folder a un repo de GitHub
2. Ve a [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Railway detecta Node.js automáticamente y lo despliega
4. Te da una URL tipo `https://tu-proyecto.up.railway.app`
5. Usa `https://tu-proyecto.up.railway.app/countdown.gif` en tu email

### Opción 2: Render
1. [render.com](https://render.com) → New Web Service → Connect repo
2. Build: `npm install` · Start: `npm start`
3. Deploy. Listo.

### Opción 3: VPS propio (DigitalOcean, Hetzner, AWS Lightsail)
```bash
git clone <tu-repo>
cd countdown-server
npm install
# Usa pm2 o systemd para que corra en background
pm2 start server.js --name countdown
```
Luego configura nginx como reverse proxy con SSL (Let's Encrypt).

### Opción 4: Vercel / Netlify
Vercel funciona pero necesitas convertir a serverless function (mover `server.js` a `api/countdown.js`). `canvas` puede dar problemas en Vercel — usa `@napi-rs/canvas` como alternativa.

---

## 🎨 Personalización

Edita la sección `CONFIG` en `server.js`:

```js
const CONFIG = {
  TARGET_DATE: '2026-06-01T00:00:00-04:00',  // ← tu fecha
  WIDTH: 500,
  HEIGHT: 140,
  FRAMES: 60,
  COLORS: {
    background: '#0a0a0a',   // fondo del GIF
    boxFill: '#1a0a2e',      // fondo de cajas
    boxBorder: '#7b2fff',    // borde de cajas
    number: '#ffffff',       // color del número
    label: '#7b2fff',        // color de "DÍAS", "HRS", etc.
    separator: '#7b2fff',    // color de los ":"
    accent: '#00f0ff'        // color del mensaje de expiración
  },
  EXPIRED_TEXT: '¡EL CYBER YA COMENZÓ!'
};
```

---

## 📧 Uso en el email

Reemplaza en `cyber-email-countdown.html` el bloque del countdown estático por:

```html
<img
  src="https://tu-servidor.com/countdown.gif"
  alt="Cuenta regresiva para Cyber 2026"
  width="500"
  style="display: block; margin: 0 auto 30px auto; max-width: 100%; height: auto;"
/>
```

---

## ⚠️ Consideraciones

- **Costo:** cada apertura del email = una request al servidor. Para 100k aperturas/día, un VPS de $5/mes alcanza sobrado.
- **Gmail cachea imágenes** vía sus proxies (`googleusercontent.com`). Por eso forzamos `no-store` y muchos servicios añaden un query param tipo `?t={timestamp}` — pero en el email no podemos generar timestamps dinámicos, así que el header `no-store` es lo que mejor funciona.
- **Outlook desktop** a veces tiene problemas con GIFs animados — muestra solo el primer frame. El primer frame del GIF ya muestra el countdown correctamente, así que igual funciona como fallback.
- **Latencia:** generar un GIF toma ~200-400ms. Considera cachear por 30 segundos en producción si tienes muchísimas aperturas simultáneas.
