/**
 * ============================================================
 *  CYBER 2026 — Countdown GIF Server
 * ============================================================
 *  Genera un GIF animado del countdown cada vez que se solicita.
 *  Cuando un cliente de email (Gmail, Outlook, etc.) carga la
 *  imagen, el servidor calcula el tiempo restante EN ESE MOMENTO
 *  y devuelve un GIF con los próximos 60 segundos animados.
 *
 *  USO EN EL EMAIL:
 *  <img src="https://tu-servidor.com/countdown.gif" alt="Countdown" />
 *
 *  DEPLOY:
 *  - Railway / Render / Fly.io / VPS propio → funciona directo
 *  - Vercel → necesita ajustar para serverless (ver notas al final)
 * ============================================================
 */

const express = require('express');
const { GifEncoder } = require('@skyra/gifenc');
const { Canvas } = require('skia-canvas');

const createCanvas = (w, h) => new Canvas(w, h);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
//  CONFIGURACIÓN — Ajusta estos valores
// ============================================================
const CONFIG = {
  // Fecha y hora del evento (ISO 8601 con timezone)
  // Chile usa UTC-4 en horario estándar, UTC-3 en verano.
  // Junio 2026 = horario estándar = UTC-4
  TARGET_DATE: '2026-06-01T00:00:00-04:00',

  // Dimensiones del GIF
  WIDTH: 500,
  HEIGHT: 140,

  // Cantidad de frames (segundos animados por GIF)
  FRAMES: 60,

  // Colores
  COLORS: {
    background: '#0a0a0a',
    boxFill: '#1a0a2e',
    boxBorder: '#7b2fff',
    number: '#ffffff',
    label: '#7b2fff',
    separator: '#7b2fff',
    accent: '#00f0ff'
  },

  // Texto al expirar
  EXPIRED_TEXT: '¡EL CYBER YA COMENZÓ!'
};

// ============================================================
//  RENDERIZADO DE UN FRAME
// ============================================================
function drawFrame(ctx, days, hours, minutes, seconds, expired = false) {
  const { WIDTH, HEIGHT, COLORS } = CONFIG;

  // Fondo
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (expired) {
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 28px Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CONFIG.EXPIRED_TEXT, WIDTH / 2, HEIGHT / 2);
    return;
  }

  const boxWidth = 90;
  const boxHeight = 90;
  const gap = 20;
  const totalWidth = boxWidth * 4 + gap * 3;
  const startX = (WIDTH - totalWidth) / 2;
  const startY = (HEIGHT - boxHeight) / 2;

  const values = [
    { num: days, label: 'DÍAS' },
    { num: hours, label: 'HRS' },
    { num: minutes, label: 'MIN' },
    { num: seconds, label: 'SEG' }
  ];

  values.forEach((v, i) => {
    const x = startX + (boxWidth + gap) * i;
    const y = startY;

    // Caja con borde
    ctx.fillStyle = COLORS.boxFill;
    ctx.strokeStyle = COLORS.boxBorder;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Número
    ctx.fillStyle = COLORS.number;
    ctx.font = 'bold 38px Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(v.num).padStart(2, '0'), x + boxWidth / 2, y + boxHeight / 2 - 8);

    // Etiqueta
    ctx.fillStyle = COLORS.label;
    ctx.font = 'bold 11px Sans';
    ctx.fillText(v.label, x + boxWidth / 2, y + boxHeight - 14);

    // Separador ":"
    if (i < values.length - 1) {
      ctx.fillStyle = COLORS.separator;
      ctx.font = 'bold 32px Sans';
      ctx.fillText(':', x + boxWidth + gap / 2, y + boxHeight / 2);
    }
  });
}

// Helper: rectángulo con bordes redondeados
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
//  CÁLCULO DEL TIEMPO RESTANTE
// ============================================================
function getRemaining(targetDate, offsetMs = 0) {
  const now = Date.now() + offsetMs;
  const target = new Date(targetDate).getTime();
  const diff = target - now;

  if (diff <= 0) return { expired: true, d: 0, h: 0, m: 0, s: 0 };

  return {
    expired: false,
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000)
  };
}

// ============================================================
//  GENERADOR DE GIF
// ============================================================
function generateCountdownGif(res) {
  const { WIDTH, HEIGHT, FRAMES } = CONFIG;

  const encoder = new GifEncoder(WIDTH, HEIGHT);

  // Headers anti-cache → fundamental para que el email recargue el GIF
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  encoder.createReadStream().pipe(res);

  encoder.start();
  encoder.setRepeat(-1);    // -1 = no repetir (loop una vez)
  encoder.setDelay(1000);   // 1 segundo por frame
  encoder.setQuality(10);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < FRAMES; i++) {
    const t = getRemaining(CONFIG.TARGET_DATE, i * 1000);

    if (t.expired) {
      drawFrame(ctx, 0, 0, 0, 0, true);
      encoder.addFrame(ctx);
      // Si ya expiró, solo necesitamos un frame estático
      break;
    } else {
      drawFrame(ctx, t.d, t.h, t.m, t.s, false);
      encoder.addFrame(ctx);
    }
  }

  encoder.finish();
}

// ============================================================
//  RUTAS
// ============================================================
app.get('/countdown.gif', (req, res) => {
  try {
    generateCountdownGif(res);
  } catch (err) {
    console.error('Error generando GIF:', err);
    res.status(500).send('Error');
  }
});

// Health check
app.get('/', (req, res) => {
  const t = getRemaining(CONFIG.TARGET_DATE);
  res.json({
    status: 'ok',
    target: CONFIG.TARGET_DATE,
    remaining: t.expired ? 'EXPIRADO' : `${t.d}d ${t.h}h ${t.m}m ${t.s}s`,
    gif_url: `/countdown.gif`
  });
});

// Preview HTML para probar visualmente
app.get('/preview', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head><title>Preview Countdown</title>
    <style>
      body { background: #f0f0f0; font-family: sans-serif; padding: 40px; text-align: center; }
      h1 { color: #333; }
      img { display: block; margin: 20px auto; border: 1px solid #ccc; }
      .info { background: white; padding: 20px; border-radius: 8px; max-width: 500px; margin: 20px auto; }
    </style></head>
    <body>
      <h1>🔥 Preview Cyber Countdown</h1>
      <img src="/countdown.gif?t=${Date.now()}" alt="Countdown" />
      <div class="info">
        <strong>Target:</strong> ${CONFIG.TARGET_DATE}<br>
        <strong>URL del GIF:</strong> <code>/countdown.gif</code><br>
        <small>Refresca la página para ver un GIF nuevo.</small>
      </div>
    </body></html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Countdown server corriendo en puerto ${PORT}`);
  console.log(`   Target: ${CONFIG.TARGET_DATE}`);
  console.log(`   GIF:     http://localhost:${PORT}/countdown.gif`);
  console.log(`   Preview: http://localhost:${PORT}/preview`);
});
