// Renders an HTML/CSS/JS overlay theme to a transparent PNG sequence, one frame per telemetry step,
// using values interpolated from a timed GPX track.
//
//   node capture.cjs --theme nfsu2 --gpx track.gpx --out frames --duration 79.88 --fps 10 [--width 1920]
//
// A theme is a static folder (or a built web app) with index.html that defines
//   window.setHudSample(sample)  // may return a Promise; frame is captured after it settles
// and an optional theme.json: { "name": "...", "clip": null | { "anchor": "top-right", "width": 540, "height": 290 } }
// clip = null (default) captures the whole frame. Output: <out>/hud_0000.png ... and <out>/clip.json
// {x, y, width, height} - where to overlay the frames on the video.
//
// Sample: { hour, minute, elapsed, speedKph, accelKph, distanceKm, lat, lon, heading, wanted, unit }
// A theme can request map tiles from /__tile/{z}/{x}/{y}.png (proxied to --tile-url and cached on disk),
// or decoded vector tiles from /__vtile/{z}/{x}/{y}.json (see vector-tiles.cjs, --vtile-url = TileJSON).
// --map raster|vector is passed to the theme as ?map=vector.
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`unexpected argument ${argv[i]}`);
    args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
for (const key of ['theme', 'gpx', 'out', 'duration']) if (!args[key]) throw new Error(`--${key} is required`);
const fps = Number(args.fps || 10);
const duration = Number(args.duration);
const width = Number(args.width || 1920);
const height = Number(args.height || 1080);
const tzHours = Number(args.tz || 0); // clock = GPX time + this offset
const wanted = Number(args.stars ?? 6); // lit wanted-level stars (GTA themes), 0..6
const unit = args.units === 'mph' ? 'mph' : 'kph';
const offset = Number(args.offset || 0); // seconds into the GPX track where the overlay starts
const tileUrl = args['tile-url'] || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const tileCache = args['tile-cache'] || path.join(os.tmpdir(), 'overlay-theme-tiles');
const mapMode = args.map || 'raster';
if (!['raster', 'vector'].includes(mapMode)) throw new Error('--map must be raster or vector');
const chrome = args.chrome || process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Chrome not found: pass --chrome or set CHROME_PATH');

// --- theme folder ---------------------------------------------------------------------------
const themeDir = path.resolve(args.theme);
if (!fs.existsSync(path.join(themeDir, 'index.html'))) throw new Error(`${themeDir} has no index.html (build the theme first?)`);
const manifestPath = path.join(themeDir, 'theme.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
function clipFor(spec) {
  if (!spec) return { x: 0, y: 0, width, height };
  const w = Math.min(spec.width, width);
  const h = Math.min(spec.height, height);
  const x = /right/.test(spec.anchor || '') ? width - w : 0;
  const y = /bottom/.test(spec.anchor || '') ? height - h : 0;
  return { x, y, width: w, height: h };
}
const clip = clipFor(manifest.clip);

// --- GPX -> samples -------------------------------------------------------------------------
const xml = fs.readFileSync(args.gpx, 'utf8');
const points = [...xml.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g)].map(([, attrs, body]) => {
  const lat = Number(attrs.match(/\blat="([^"]+)"/)?.[1]);
  const lon = Number(attrs.match(/\blon="([^"]+)"/)?.[1]);
  const time = Date.parse(body.match(/<time>([^<]+)<\/time>/)?.[1] || '');
  if (![lat, lon, time].every(Number.isFinite)) throw new Error('GPX point without lat, lon or time');
  return { lat, lon, time, cum: 0, speed: 0 };
});
if (points.length < 2) throw new Error('GPX needs at least two timed points');
const rad = (v) => (v * Math.PI) / 180;
const deg = (v) => (v * 180) / Math.PI;
const segment = [];
for (let i = 1; i < points.length; i++) {
  const a = points[i - 1];
  const b = points[i];
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  const meters = 2 * 6371000 * Math.asin(Math.sqrt(h));
  b.cum = a.cum + meters;
  b.speed = (meters / Math.max(0.001, (b.time - a.time) / 1000)) * 3.6;
  segment.push(meters);
}
const startMs = points[0].time;

function stateAt(seconds) {
  const ms = startMs + (seconds + offset) * 1000;
  let i = 0;
  while (i < points.length - 2 && points[i + 1].time < ms) i++;
  const a = points[i];
  const b = points[i + 1];
  const f = Math.max(0, Math.min(1, (ms - a.time) / Math.max(1, b.time - a.time)));
  return {
    ms,
    lat: a.lat + (b.lat - a.lat) * f,
    lon: a.lon + (b.lon - a.lon) * f,
    speed: a.speed + (b.speed - a.speed) * f,
    cum: a.cum + segment[i] * f,
  };
}
function bearing(p, q) {
  const dLon = rad(q.lon - p.lon);
  const y = Math.sin(dLon) * Math.cos(rad(q.lat));
  const x = Math.cos(rad(p.lat)) * Math.sin(rad(q.lat)) - Math.sin(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
let lastHeading = 0;
function sampleAt(seconds) {
  const s = stateAt(seconds);
  const before = stateAt(Math.max(0, seconds - 0.7));
  const after = stateAt(seconds + 0.7);
  if (Math.abs(after.cum - before.cum) > 0.3) lastHeading = bearing(before, after);
  const local = new Date(s.ms + tzHours * 3600 * 1000);
  return {
    hour: local.getUTCHours() % 12 || 12,
    minute: local.getUTCMinutes(),
    elapsed: seconds,
    speedKph: s.speed,
    accelKph: Math.max(-30, Math.min(30, after.speed - before.speed)) / 1.4,
    distanceKm: s.cum / 1000,
    lat: s.lat,
    lon: s.lon,
    heading: lastHeading,
    wanted,
    unit,
  };
}

// --- static server + tile proxy -------------------------------------------------------------
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.map': 'application/json' };
const userAgent = 'video-overlay-cli-theme-capture/1.0 (+https://github.com/infabls/video-overlay-cli)';
fs.mkdirSync(tileCache, { recursive: true });

function fetchTile(url, file, res) {
  https.get(url, { headers: { 'User-Agent': userAgent } }, (up) => {
    if (up.statusCode !== 200) { up.resume(); res.writeHead(502).end(); return; }
    const chunks = [];
    up.on('data', (c) => chunks.push(c));
    up.on('end', () => {
      const body = Buffer.concat(chunks);
      fs.writeFileSync(file, body);
      res.writeHead(200, { 'Content-Type': 'image/png' }).end(body);
    });
  }).on('error', () => res.writeHead(502).end());
}

let vectorTiles = null; // loaded on first use: raster themes do not need the decoder packages
function serveVectorTile(z, x, y, res) {
  vectorTiles ??= require('./vector-tiles.cjs').createVectorTiles({
    cacheDir: path.join(tileCache, 'vector'),
    tileJson: args['vtile-url'],
  });
  vectorTiles(z, x, y).then(
    (data) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data)),
    (error) => { console.error('vector tile:', error.message); res.writeHead(502).end(); },
  );
}

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const vtile = rel.match(/^\/__vtile\/(\d+)\/(\d+)\/(\d+)\.json$/);
  if (vtile) { serveVectorTile(Number(vtile[1]), Number(vtile[2]), Number(vtile[3]), res); return; }
  if (rel === '/__shared/vector-map.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    fs.createReadStream(path.join(__dirname, 'shared', 'vector-map.js')).pipe(res);
    return;
  }
  const tile = rel.match(/^\/__tile\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (tile) {
    const [, z, x, y] = tile;
    const file = path.join(tileCache, `${z}_${x}_${y}.png`);
    if (fs.existsSync(file)) { res.writeHead(200, { 'Content-Type': 'image/png' }); fs.createReadStream(file).pipe(res); return; }
    fetchTile(tileUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y), file, res);
    return;
  }
  const file = path.normalize(path.join(themeDir, rel === '/' ? 'index.html' : rel));
  if (!file.startsWith(themeDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${mapMode === 'vector' ? '?map=vector' : ''}`;
  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(path.join(args.out, 'clip.json'), JSON.stringify(clip));
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(url);
    await page.waitForFunction('typeof window.setHudSample === "function"', { timeout: 15000 });
    await page.evaluate('document.fonts.ready.then(() => true)');
    const count = Math.ceil(duration * fps);
    for (let n = 0; n < count; n++) {
      await page.evaluate(async (sample) => {
        await window.setHudSample(sample);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, sampleAt(n / fps));
      await page.screenshot({ path: path.join(args.out, `hud_${String(n).padStart(4, '0')}.png`), omitBackground: true, clip });
      if (n % 100 === 0) console.log(`captured ${n}/${count}`);
    }
    console.log(`captured ${count} frames (${clip.width}x${clip.height} at ${clip.x},${clip.y}) in ${args.out}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
