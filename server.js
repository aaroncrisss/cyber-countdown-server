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
const { Canvas, FontLibrary } = require('skia-canvas');
const fs = require('fs');
const path = require('path');

const createCanvas = (w, h) => new Canvas(w, h);

const FONT_FAMILY = 'Countdown';
const FONT_DIRS = [
  '/usr/share/fonts/truetype/liberation',
  '/usr/share/fonts/truetype/dejavu',
  '/usr/share/fonts',
];

(function loadFont() {
  for (const dir of FONT_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir, { recursive: true });
    const bold = files.find(f => /liberation.*sans.*bold/i.test(String(f)) && String(f).endsWith('.ttf'));
    const regular = files.find(f => /liberation.*sans/i.test(String(f)) && !/bold|italic/i.test(String(f)) && String(f).endsWith('.ttf'));
    const font = bold || regular;
    if (font) {
      const fullPath = path.join(dir, String(font));
      FontLibrary.use(FONT_FAMILY, [fullPath]);
      console.log(`Font loaded: ${fullPath}`);
      return;
    }
  }
  const allFonts = FontLibrary.families;
  console.warn('Liberation Sans not found. Available font families:', allFonts);
})();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
//  CONFIGURACIÓN — Todo configurable via env vars
//
//  En Railway: Settings > Variables, sin redesplegar código.
//  También se pueden sobreescribir por query param en la URL:
//    /countdown.gif?frames=120&width=600&bg=%230a0a0a
// ============================================================
const DEFAULTS = {
  TARGET_DATE: process.env.TARGET_DATE || '2026-06-01T00:00:00-04:00',
  WIDTH: parseInt(process.env.GIF_WIDTH) || 500,
  HEIGHT: parseInt(process.env.GIF_HEIGHT) || 140,
  FRAMES: parseInt(process.env.GIF_FRAMES) || 60,
  EXPIRED_TEXT: process.env.EXPIRED_TEXT || '¡EL CYBER YA COMENZÓ!',
  COLORS: {
    background: process.env.COLOR_BG || '#0a0a0a',
    boxFill: process.env.COLOR_BOX_FILL || '#1a0a2e',
    boxBorder: process.env.COLOR_BOX_BORDER || '#7b2fff',
    number: process.env.COLOR_NUMBER || '#ffffff',
    label: process.env.COLOR_LABEL || '#7b2fff',
    separator: process.env.COLOR_SEPARATOR || '#7b2fff',
    accent: process.env.COLOR_ACCENT || '#00f0ff',
  },
};

function getConfig(query = {}) {
  return {
    TARGET_DATE: query.target || DEFAULTS.TARGET_DATE,
    WIDTH: parseInt(query.width) || DEFAULTS.WIDTH,
    HEIGHT: parseInt(query.height) || DEFAULTS.HEIGHT,
    FRAMES: Math.min(parseInt(query.frames) || DEFAULTS.FRAMES, 600),
    EXPIRED_TEXT: query.expired_text || DEFAULTS.EXPIRED_TEXT,
    COLORS: {
      background: query.bg || DEFAULTS.COLORS.background,
      boxFill: query.box_fill || DEFAULTS.COLORS.boxFill,
      boxBorder: query.box_border || DEFAULTS.COLORS.boxBorder,
      number: query.color_number || DEFAULTS.COLORS.number,
      label: query.color_label || DEFAULTS.COLORS.label,
      separator: query.color_separator || DEFAULTS.COLORS.separator,
      accent: query.color_accent || DEFAULTS.COLORS.accent,
    },
  };
}

// ============================================================
//  RENDERIZADO DE UN FRAME
// ============================================================
function drawFrame(ctx, days, hours, minutes, seconds, config, expired = false) {
  const { WIDTH, HEIGHT, COLORS } = config;

  // Fondo
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (expired) {
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 28px Countdown, Liberation Sans, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.EXPIRED_TEXT, WIDTH / 2, HEIGHT / 2);
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
    ctx.font = 'bold 38px Countdown, Liberation Sans, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(v.num).padStart(2, '0'), x + boxWidth / 2, y + boxHeight / 2 - 8);

    // Etiqueta
    ctx.fillStyle = COLORS.label;
    ctx.font = 'bold 11px Countdown, Liberation Sans, Arial, sans-serif';
    ctx.fillText(v.label, x + boxWidth / 2, y + boxHeight - 14);

    // Separador ":"
    if (i < values.length - 1) {
      ctx.fillStyle = COLORS.separator;
      ctx.font = 'bold 32px Countdown, Liberation Sans, Arial, sans-serif';
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
function generateCountdownGif(res, config) {
  const { WIDTH, HEIGHT, FRAMES } = config;

  const encoder = new GifEncoder(WIDTH, HEIGHT);

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  encoder.createReadStream().pipe(res);

  encoder.start();
  encoder.setRepeat(0);     // 0 = loop forever
  encoder.setDelay(1000);
  encoder.setQuality(10);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < FRAMES; i++) {
    const t = getRemaining(config.TARGET_DATE, i * 1000);

    if (t.expired) {
      drawFrame(ctx, 0, 0, 0, 0, config, true);
      encoder.addFrame(ctx);
      break;
    } else {
      drawFrame(ctx, t.d, t.h, t.m, t.s, config);
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
    const config = getConfig(req.query);
    generateCountdownGif(res, config);
  } catch (err) {
    console.error('Error generando GIF:', err);
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => {
  const t = getRemaining(DEFAULTS.TARGET_DATE);
  res.json({
    status: 'ok',
    target: DEFAULTS.TARGET_DATE,
    remaining: t.expired ? 'EXPIRADO' : `${t.d}d ${t.h}h ${t.m}m ${t.s}s`,
    gif_url: `/countdown.gif`,
    config: {
      frames: DEFAULTS.FRAMES,
      width: DEFAULTS.WIDTH,
      height: DEFAULTS.HEIGHT,
    },
    query_params: 'target, frames, width, height, bg, box_fill, box_border, color_number, color_label, color_separator, color_accent, expired_text',
    env_vars: 'TARGET_DATE, GIF_FRAMES, GIF_WIDTH, GIF_HEIGHT, COLOR_BG, COLOR_BOX_FILL, COLOR_BOX_BORDER, COLOR_NUMBER, COLOR_LABEL, COLOR_SEPARATOR, COLOR_ACCENT, EXPIRED_TEXT',
  });
});

app.get('/preview', (req, res) => {
  const config = getConfig(req.query);
  const qs = new URLSearchParams(req.query);
  qs.set('t', Date.now());
  res.send(`
    <!DOCTYPE html>
    <html><head><title>Preview Countdown</title>
    <style>
      body { background: #111; font-family: sans-serif; padding: 40px; text-align: center; color: #ccc; }
      h1 { color: #fff; }
      img { display: block; margin: 20px auto; }
      .info { background: #1a1a1a; padding: 20px; border-radius: 8px; max-width: 600px; margin: 20px auto; text-align: left; }
      .info code { color: #7b2fff; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { text-align: left; padding: 4px 8px; font-size: 13px; }
      th { color: #7b2fff; }
      td code { color: #00f0ff; font-size: 12px; }
    </style></head>
    <body>
      <h1>🔥 Preview Cyber Countdown</h1>
      <img src="/countdown.gif?${qs.toString()}" alt="Countdown" />
      <div class="info">
        <strong>Target:</strong> <code>${config.TARGET_DATE}</code><br>
        <strong>Frames:</strong> <code>${config.FRAMES}</code> (${config.FRAMES}s de animación)<br>
        <strong>Size:</strong> <code>${config.WIDTH}x${config.HEIGHT}</code><br><br>
        <strong>Query params disponibles:</strong>
        <table>
          <tr><th>Param</th><th>Ejemplo</th></tr>
          <tr><td>target</td><td><code>2026-06-01T00:00:00-04:00</code></td></tr>
          <tr><td>frames</td><td><code>120</code> (max 600)</td></tr>
          <tr><td>width / height</td><td><code>600</code> / <code>160</code></td></tr>
          <tr><td>bg</td><td><code>#0a0a0a</code></td></tr>
          <tr><td>box_fill / box_border</td><td><code>#1a0a2e</code> / <code>#7b2fff</code></td></tr>
          <tr><td>color_number / color_label</td><td><code>#ffffff</code> / <code>#7b2fff</code></td></tr>
          <tr><td>expired_text</td><td><code>YA COMENZÓ</code></td></tr>
        </table>
        <br><small>Refresca la página para un GIF nuevo. Los mismos params se pueden setear como env vars en Railway.</small>
      </div>
    </body></html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Countdown server corriendo en puerto ${PORT}`);
  console.log(`   Target:  ${DEFAULTS.TARGET_DATE}`);
  console.log(`   Frames:  ${DEFAULTS.FRAMES}`);
  console.log(`   GIF:     http://localhost:${PORT}/countdown.gif`);
  console.log(`   Preview: http://localhost:${PORT}/preview`);
});
