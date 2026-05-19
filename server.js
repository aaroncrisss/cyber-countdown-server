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
  res.send(`<!DOCTYPE html>
<html><head><title>Preview Countdown</title>
<style>
  body { background: #111; font-family: sans-serif; padding: 40px; text-align: center; color: #ccc; }
  h1 { color: #fff; }
  img { display: block; margin: 20px auto; }
  .info { background: #1a1a1a; padding: 20px; border-radius: 8px; max-width: 600px; margin: 20px auto; text-align: left; }
  .info code { color: #7b2fff; }
</style></head>
<body>
  <h1>🔥 Preview Cyber Countdown</h1>
  <img src="/countdown.gif?${qs.toString()}" alt="Countdown" />
  <div class="info">
    <strong>Target:</strong> <code>${config.TARGET_DATE}</code><br>
    <strong>Frames:</strong> <code>${config.FRAMES}</code> (${config.FRAMES}s de animación)<br>
    <strong>Size:</strong> <code>${config.WIDTH}x${config.HEIGHT}</code><br><br>
    <a href="/editor" style="color:#7b2fff">Abrir Editor Visual →</a>
  </div>
</body></html>`);
});

app.get('/editor', (req, res) => {
  const d = DEFAULTS;
  const c = d.COLORS;
  res.send(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Countdown Editor</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0e0e0e; color: #e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif; }
  .layout { display: grid; grid-template-columns: 340px 1fr; min-height: 100vh; }

  .sidebar { background: #161616; border-right: 1px solid #2a2a2a; padding: 24px; overflow-y: auto; }
  .sidebar h1 { font-size: 18px; color: #fff; margin-bottom: 20px; }

  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #666; margin-bottom: 10px; font-weight: 600; }

  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 12px; color: #999; margin-bottom: 4px; }
  .field input[type="text"],
  .field input[type="number"],
  .field input[type="datetime-local"] {
    width: 100%; padding: 8px 10px; background: #0e0e0e; border: 1px solid #333;
    border-radius: 6px; color: #fff; font-size: 13px; outline: none;
  }
  .field input:focus { border-color: #7b2fff; }

  .color-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .color-row label { font-size: 12px; color: #999; min-width: 90px; }
  .color-row input[type="color"] {
    width: 32px; height: 32px; border: 1px solid #333; border-radius: 6px;
    cursor: pointer; background: none; padding: 2px;
  }
  .color-row code { font-size: 11px; color: #666; }

  .range-row { margin-bottom: 14px; }
  .range-row label { display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-bottom: 4px; }
  .range-row label span { color: #7b2fff; font-weight: 600; }
  .range-row input[type="range"] { width: 100%; accent-color: #7b2fff; }

  .main { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 24px; }

  #gif-preview { border: 1px solid #222; border-radius: 8px; }
  #loading { display: none; color: #666; font-size: 13px; }

  .url-box {
    background: #161616; border: 1px solid #2a2a2a; border-radius: 8px;
    padding: 16px; width: 100%; max-width: 700px;
  }
  .url-box label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 6px; display: block; }
  .url-row { display: flex; gap: 8px; }
  .url-row input {
    flex: 1; padding: 10px 12px; background: #0e0e0e; border: 1px solid #333;
    border-radius: 6px; color: #00f0ff; font-family: monospace; font-size: 12px; outline: none;
  }
  .url-row button, .btn {
    padding: 8px 16px; background: #7b2fff; color: #fff; border: none;
    border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;
  }
  .url-row button:hover, .btn:hover { background: #6a1fef; }
  .btn-outline { background: transparent; border: 1px solid #333; color: #ccc; }
  .btn-outline:hover { border-color: #7b2fff; color: #fff; background: transparent; }

  .actions { display: flex; gap: 8px; margin-top: 16px; }
  .toast {
    position: fixed; bottom: 20px; right: 20px; background: #7b2fff; color: #fff;
    padding: 10px 20px; border-radius: 8px; font-size: 13px; opacity: 0;
    transition: opacity 0.3s; pointer-events: none;
  }
  .toast.show { opacity: 1; }

  @media (max-width: 768px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { border-right: none; border-bottom: 1px solid #2a2a2a; }
  }
</style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <h1>🔥 Countdown Editor</h1>

    <div class="section">
      <div class="section-title">Evento</div>
      <div class="field">
        <label>Fecha y hora objetivo</label>
        <input type="datetime-local" id="target" value="${d.TARGET_DATE.slice(0, 19)}">
      </div>
      <div class="field">
        <label>Timezone offset (ej: -04:00)</label>
        <input type="text" id="tz" value="${d.TARGET_DATE.slice(19) || '-04:00'}" placeholder="-04:00">
      </div>
      <div class="field">
        <label>Texto al expirar</label>
        <input type="text" id="expired_text" value="${d.EXPIRED_TEXT}">
      </div>
    </div>

    <div class="section">
      <div class="section-title">Dimensiones</div>
      <div class="range-row">
        <label>Ancho <span id="w-val">${d.WIDTH}</span>px</label>
        <input type="range" id="width" min="300" max="800" value="${d.WIDTH}">
      </div>
      <div class="range-row">
        <label>Alto <span id="h-val">${d.HEIGHT}</span>px</label>
        <input type="range" id="height" min="80" max="300" value="${d.HEIGHT}">
      </div>
    </div>

    <div class="section">
      <div class="range-row">
        <label>Duración <span id="f-val">${d.FRAMES}</span>s</label>
        <input type="range" id="frames" min="10" max="600" step="10" value="${d.FRAMES}">
      </div>
    </div>

    <div class="section">
      <div class="section-title">Colores</div>
      <div class="color-row"><label>Fondo</label><input type="color" id="bg" value="${c.background}"><code id="bg-hex">${c.background}</code></div>
      <div class="color-row"><label>Caja relleno</label><input type="color" id="box_fill" value="${c.boxFill}"><code id="box_fill-hex">${c.boxFill}</code></div>
      <div class="color-row"><label>Caja borde</label><input type="color" id="box_border" value="${c.boxBorder}"><code id="box_border-hex">${c.boxBorder}</code></div>
      <div class="color-row"><label>Números</label><input type="color" id="color_number" value="${c.number}"><code id="color_number-hex">${c.number}</code></div>
      <div class="color-row"><label>Etiquetas</label><input type="color" id="color_label" value="${c.label}"><code id="color_label-hex">${c.label}</code></div>
      <div class="color-row"><label>Separador</label><input type="color" id="color_separator" value="${c.separator}"><code id="color_separator-hex">${c.separator}</code></div>
      <div class="color-row"><label>Acento</label><input type="color" id="color_accent" value="${c.accent}"><code id="color_accent-hex">${c.accent}</code></div>
    </div>

    <div class="actions">
      <button class="btn" onclick="updatePreview()">Generar GIF</button>
      <button class="btn btn-outline" onclick="resetDefaults()">Reset</button>
    </div>
  </div>

  <div class="main">
    <img id="gif-preview" alt="Countdown Preview" />
    <div id="loading">Generando GIF...</div>

    <div class="url-box">
      <label>URL para email / embed</label>
      <div class="url-row">
        <input type="text" id="gif-url" readonly>
        <button onclick="copyUrl()">Copiar</button>
      </div>
    </div>

    <div class="url-box">
      <label>HTML para email</label>
      <div class="url-row">
        <input type="text" id="html-snippet" readonly>
        <button onclick="copyHtml()">Copiar</button>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const $ = id => document.getElementById(id);
const base = location.origin;

const rangeIds = [
  { input: 'width', display: 'w-val' },
  { input: 'height', display: 'h-val' },
  { input: 'frames', display: 'f-val' },
];
rangeIds.forEach(r => {
  $(r.input).addEventListener('input', () => { $(r.display).textContent = $(r.input).value; });
});

const colorIds = ['bg','box_fill','box_border','color_number','color_label','color_separator','color_accent'];
colorIds.forEach(id => {
  $(id).addEventListener('input', () => { $(id + '-hex').textContent = $(id).value; });
});

function buildParams() {
  const p = new URLSearchParams();
  const target = $('target').value + ($('tz').value || '-04:00');
  p.set('target', target);
  p.set('frames', $('frames').value);
  p.set('width', $('width').value);
  p.set('height', $('height').value);
  p.set('expired_text', $('expired_text').value);
  colorIds.forEach(id => p.set(id, $(id).value));
  return p;
}

function buildGifUrl() {
  const p = buildParams();
  return base + '/countdown.gif?' + p.toString();
}

function updatePreview() {
  const url = buildGifUrl();
  const img = $('gif-preview');
  const loading = $('loading');

  loading.style.display = 'block';
  img.style.opacity = '0.4';

  const p = buildParams();
  p.set('t', Date.now());
  const freshUrl = base + '/countdown.gif?' + p.toString();

  const tmp = new Image();
  tmp.onload = () => {
    img.src = freshUrl;
    img.style.opacity = '1';
    loading.style.display = 'none';
  };
  tmp.onerror = () => {
    img.style.opacity = '1';
    loading.style.display = 'none';
    showToast('Error generando GIF');
  };
  tmp.src = freshUrl;

  $('gif-url').value = url;
  $('html-snippet').value = '<img src="' + url + '" alt="Countdown" />';
}

function copyUrl() {
  navigator.clipboard.writeText($('gif-url').value);
  showToast('URL copiada');
}
function copyHtml() {
  navigator.clipboard.writeText($('html-snippet').value);
  showToast('HTML copiado');
}

function resetDefaults() {
  $('target').value = '${d.TARGET_DATE.slice(0, 19)}';
  $('tz').value = '${d.TARGET_DATE.slice(19) || '-04:00'}';
  $('expired_text').value = '${d.EXPIRED_TEXT}';
  $('width').value = ${d.WIDTH}; $('w-val').textContent = ${d.WIDTH};
  $('height').value = ${d.HEIGHT}; $('h-val').textContent = ${d.HEIGHT};
  $('frames').value = ${d.FRAMES}; $('f-val').textContent = ${d.FRAMES};
  const defaults = ${JSON.stringify(c)};
  const map = { bg:'background', box_fill:'boxFill', box_border:'boxBorder',
    color_number:'number', color_label:'label', color_separator:'separator', color_accent:'accent' };
  Object.entries(map).forEach(([id, key]) => {
    $(id).value = defaults[key];
    $(id+'-hex').textContent = defaults[key];
  });
  updatePreview();
}

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

updatePreview();
</script>
</body></html>`);
});

app.listen(PORT, () => {
  console.log(`🚀 Countdown server corriendo en puerto ${PORT}`);
  console.log(`   Target:  ${DEFAULTS.TARGET_DATE}`);
  console.log(`   Frames:  ${DEFAULTS.FRAMES}`);
  console.log(`   GIF:     http://localhost:${PORT}/countdown.gif`);
  console.log(`   Preview: http://localhost:${PORT}/preview`);
});
