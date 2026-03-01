const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAIN_OUT_DIR = path.join(__dirname, '..', 'assets', 'images');
const VARIANT_OUT_ROOT = path.join(MAIN_OUT_DIR, 'variants');

const VARIANTS = {
  horizon: {
    name: 'horizon',
    bgTopLeft: '#0B5FFF',
    bgBottomRight: '#1DBA8C',
    routeMain: '#FFE082',
    symbol: '#FFFFFF',
    center: '#0B5FFF',
    monochrome: '#111111',
    splashPin: '#0B5FFF',
    splashRoute: '#1DBA8C',
  },
  trail: {
    name: 'trail',
    bgTopLeft: '#FF6A3D',
    bgBottomRight: '#0E8F74',
    routeMain: '#FFF1A8',
    symbol: '#FFFFFF',
    center: '#FF6A3D',
    monochrome: '#161616',
    splashPin: '#D84D2C',
    splashRoute: '#0E8F74',
  },
  metro: {
    name: 'metro',
    bgTopLeft: '#162447',
    bgBottomRight: '#1F8EA3',
    routeMain: '#B6F5FF',
    symbol: '#FFFFFF',
    center: '#162447',
    monochrome: '#0F0F0F',
    splashPin: '#162447',
    splashRoute: '#1F8EA3',
  },
  terra: {
    name: 'terra',
    bgTopLeft: '#2F5D50',
    bgBottomRight: '#85A947',
    routeMain: '#FFE8B5',
    symbol: '#FFFFFF',
    center: '#2F5D50',
    monochrome: '#1A1A1A',
    splashPin: '#2F5D50',
    splashRoute: '#85A947',
  },
};

function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  if (clean.length === 6) {
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: Math.round(alpha * 255) };
  }
  throw new Error(`Unsupported hex color: ${hex}`);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
    a: Math.round(lerp(c1.a, c2.a, t)),
  };
}

function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4),
  };
}

function blendPixel(canvas, x, y, src) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;

  const dstR = canvas.data[i + 0];
  const dstG = canvas.data[i + 1];
  const dstB = canvas.data[i + 2];
  const dstA = canvas.data[i + 3] / 255;

  const srcA = src.a / 255;
  const outA = srcA + dstA * (1 - srcA);

  if (outA <= 0) {
    canvas.data[i + 0] = 0;
    canvas.data[i + 1] = 0;
    canvas.data[i + 2] = 0;
    canvas.data[i + 3] = 0;
    return;
  }

  const outR = (src.r * srcA + dstR * dstA * (1 - srcA)) / outA;
  const outG = (src.g * srcA + dstG * dstA * (1 - srcA)) / outA;
  const outB = (src.b * srcA + dstB * dstA * (1 - srcA)) / outA;

  canvas.data[i + 0] = Math.round(outR);
  canvas.data[i + 1] = Math.round(outG);
  canvas.data[i + 2] = Math.round(outB);
  canvas.data[i + 3] = Math.round(outA * 255);
}

function insideRoundedRect(x, y, w, h, r) {
  if (x >= r && x < w - r) return true;
  if (y >= r && y < h - r) return true;

  const cx = x < r ? r : w - r - 1;
  const cy = y < r ? r : h - r - 1;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function fillRoundedGradient(canvas, radius, topLeftHex, bottomRightHex) {
  const c1 = hexToRgba(topLeftHex, 1);
  const c2 = hexToRgba(bottomRightHex, 1);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (!insideRoundedRect(x, y, canvas.width, canvas.height, radius)) continue;
      const tx = x / (canvas.width - 1);
      const ty = y / (canvas.height - 1);
      const t = Math.min(1, Math.max(0, tx * 0.45 + ty * 0.85));
      const color = lerpColor(c1, c2, t);
      blendPixel(canvas, x, y, color);
    }
  }
}

function fillGradient(canvas, topLeftHex, bottomRightHex) {
  const c1 = hexToRgba(topLeftHex, 1);
  const c2 = hexToRgba(bottomRightHex, 1);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const tx = x / (canvas.width - 1);
      const ty = y / (canvas.height - 1);
      const t = Math.min(1, Math.max(0, tx * 0.45 + ty * 0.85));
      const color = lerpColor(c1, c2, t);
      blendPixel(canvas, x, y, color);
    }
  }
}

function fillCircle(canvas, cx, cy, r, color) {
  const minX = Math.floor(cx - r);
  const maxX = Math.ceil(cx + r);
  const minY = Math.floor(cy - r);
  const maxY = Math.ceil(cy + r);
  const rr = r * r;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rr) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPolygon(canvas, points, color) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function drawSegment(canvas, x1, y1, x2, y2, thickness, color) {
  const r = thickness / 2;
  const minX = Math.floor(Math.min(x1, x2) - r);
  const maxX = Math.ceil(Math.max(x1, x2) + r);
  const minY = Math.floor(Math.min(y1, y2) - r);
  const maxY = Math.ceil(Math.max(y1, y2) + r);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distancePointToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2);
      if (d <= r) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
}

function drawPolyline(canvas, points, thickness, color) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    drawSegment(canvas, x1, y1, x2, y2, thickness, color);
  }
}

function drawMainIcon(size, variant) {
  const c = createCanvas(size, size);
  const radius = Math.round(size * 0.23);

  fillRoundedGradient(c, radius, variant.bgTopLeft, variant.bgBottomRight);

  const routeColor = hexToRgba(variant.routeMain, 0.95);
  const dotColor = hexToRgba(variant.symbol, 1);
  const pinColor = hexToRgba(variant.symbol, 1);
  const centerColor = hexToRgba(variant.center, 1);

  const route = [
    [size * 0.18, size * 0.74],
    [size * 0.34, size * 0.62],
    [size * 0.5, size * 0.68],
    [size * 0.62, size * 0.54],
  ];

  drawPolyline(c, route, size * 0.08, routeColor);
  fillCircle(c, size * 0.18, size * 0.74, size * 0.045, dotColor);
  fillCircle(c, size * 0.5, size * 0.68, size * 0.038, dotColor);

  const cx = size * 0.64;
  const cy = size * 0.35;
  const r = size * 0.16;

  fillCircle(c, cx, cy, r, pinColor);
  fillPolygon(
    c,
    [
      [cx - r * 0.62, cy + r * 0.64],
      [cx + r * 0.62, cy + r * 0.64],
      [cx, cy + r * 1.95],
    ],
    pinColor,
  );
  fillCircle(c, cx, cy, r * 0.43, centerColor);

  return c;
}

function drawAdaptiveBackground(size, variant) {
  const c = createCanvas(size, size);
  fillGradient(c, variant.bgTopLeft, variant.bgBottomRight);
  return c;
}

function drawAdaptiveForeground(size, variant) {
  const c = createCanvas(size, size);
  const routeColor = hexToRgba(variant.symbol, 0.95);
  const pinColor = hexToRgba(variant.symbol, 1);
  const centerColor = hexToRgba(variant.center, 1);

  const route = [
    [size * 0.18, size * 0.74],
    [size * 0.34, size * 0.62],
    [size * 0.5, size * 0.68],
    [size * 0.62, size * 0.54],
  ];
  drawPolyline(c, route, size * 0.09, routeColor);
  fillCircle(c, size * 0.18, size * 0.74, size * 0.05, pinColor);
  fillCircle(c, size * 0.5, size * 0.68, size * 0.04, pinColor);

  const cx = size * 0.64;
  const cy = size * 0.35;
  const r = size * 0.17;
  fillCircle(c, cx, cy, r, pinColor);
  fillPolygon(
    c,
    [
      [cx - r * 0.62, cy + r * 0.64],
      [cx + r * 0.62, cy + r * 0.64],
      [cx, cy + r * 1.95],
    ],
    pinColor,
  );
  fillCircle(c, cx, cy, r * 0.43, centerColor);

  return c;
}

function drawMonochrome(size, variant) {
  const c = createCanvas(size, size);
  const mono = hexToRgba(variant.monochrome, 1);

  const route = [
    [size * 0.18, size * 0.74],
    [size * 0.34, size * 0.62],
    [size * 0.5, size * 0.68],
    [size * 0.62, size * 0.54],
  ];
  drawPolyline(c, route, size * 0.09, mono);
  fillCircle(c, size * 0.18, size * 0.74, size * 0.05, mono);
  fillCircle(c, size * 0.5, size * 0.68, size * 0.04, mono);

  const cx = size * 0.64;
  const cy = size * 0.35;
  const r = size * 0.17;
  fillCircle(c, cx, cy, r, mono);
  fillPolygon(
    c,
    [
      [cx - r * 0.62, cy + r * 0.64],
      [cx + r * 0.62, cy + r * 0.64],
      [cx, cy + r * 1.95],
    ],
    mono,
  );

  return c;
}

function drawSplash(size, variant) {
  const c = createCanvas(size, size);
  const pinColor = hexToRgba(variant.splashPin, 1);
  const routeColor = hexToRgba(variant.splashRoute, 1);

  const route = [
    [size * 0.16, size * 0.78],
    [size * 0.35, size * 0.63],
    [size * 0.52, size * 0.7],
    [size * 0.64, size * 0.55],
  ];
  drawPolyline(c, route, size * 0.085, routeColor);
  fillCircle(c, size * 0.16, size * 0.78, size * 0.048, routeColor);

  const cx = size * 0.64;
  const cy = size * 0.36;
  const r = size * 0.18;
  fillCircle(c, cx, cy, r, pinColor);
  fillPolygon(
    c,
    [
      [cx - r * 0.62, cy + r * 0.64],
      [cx + r * 0.62, cy + r * 0.64],
      [cx, cy + r * 1.95],
    ],
    pinColor,
  );
  fillCircle(c, cx, cy, r * 0.43, hexToRgba('#FFFFFF', 1));

  return c;
}

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = buildCrc32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = u32be(data.length);
  const crcBuf = u32be(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(canvas) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    const srcStart = y * stride;
    raw.set(canvas.data.subarray(srcStart, srcStart + stride), rowStart + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function savePng(filename, canvas, outDir) {
  const filePath = path.join(outDir, filename);
  const png = encodePng(canvas);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${path.relative(path.join(__dirname, '..'), filePath)} (${canvas.width}x${canvas.height})`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateSet(variant, outDir) {
  ensureDir(outDir);
  savePng('icon.png', drawMainIcon(1024, variant), outDir);
  savePng('android-icon-background.png', drawAdaptiveBackground(1024, variant), outDir);
  savePng('android-icon-foreground.png', drawAdaptiveForeground(1024, variant), outDir);
  savePng('android-icon-monochrome.png', drawMonochrome(1024, variant), outDir);
  savePng('splash-icon.png', drawSplash(1024, variant), outDir);
  savePng('favicon.png', drawMainIcon(48, variant), outDir);
}

function parseArgs(argv) {
  const opts = {
    variant: 'horizon',
    all: false,
    out: MAIN_OUT_DIR,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--variant') {
      opts.variant = argv[++i];
    } else if (arg === '--out') {
      opts.out = path.resolve(argv[++i]);
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.all) {
    ensureDir(VARIANT_OUT_ROOT);
    for (const variant of Object.values(VARIANTS)) {
      generateSet(variant, path.join(VARIANT_OUT_ROOT, variant.name));
    }
    return;
  }

  const variant = VARIANTS[opts.variant];
  if (!variant) {
    const names = Object.keys(VARIANTS).join(', ');
    throw new Error(`Unknown variant: ${opts.variant}. Available: ${names}`);
  }

  generateSet(variant, opts.out);
}

main();
