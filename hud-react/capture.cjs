// Renders the React GTA SA HUD (hud-react/build) to a transparent PNG sequence, one frame per
// telemetry step, using values interpolated from a timed GPX track.
//
//   node capture.cjs --gpx track.gpx --out frames --duration 79.88 --fps 10 [--width 1920] [--tz 0]
//
// Output: <out>/hud_0000.png ... cropped to the top-right corner (HUD_W x HUD_H).
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const HUD_W = 540;
const HUD_H = 290;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`unexpected argument ${argv[i]}`);
    args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
for (const key of ['gpx', 'out', 'duration']) if (!args[key]) throw new Error(`--${key} is required`);
const fps = Number(args.fps || 10);
const duration = Number(args.duration);
const width = Number(args.width || 1920);
const height = Number(args.height || 1080);
const tzHours = Number(args.tz || 0); // clock shown on the HUD = GPX time + this offset
const wanted = Number(args.stars ?? 6); // lit wanted-level stars, 0..6
const offset = Number(args.offset || 0); // seconds into the GPX track where the video starts
const chrome = args.chrome || process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Chrome not found: pass --chrome or set CHROME_PATH');

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
function sampleAt(seconds) {
  const ms = startMs + (seconds + offset) * 1000;
  let i = 0;
  while (i < points.length - 2 && points[i + 1].time < ms) i++;
  const a = points[i];
  const b = points[i + 1];
  const f = Math.max(0, Math.min(1, (ms - a.time) / Math.max(1, b.time - a.time)));
  const local = new Date(ms + tzHours * 3600 * 1000);
  return {
    hour: local.getUTCHours() % 12 || 12,
    minute: local.getUTCMinutes(),
    speedKph: a.speed + (b.speed - a.speed) * f,
    distanceKm: (a.cum + segment[i] * f) / 1000,
    wanted,
  };
}

// --- static server for the CRA build -------------------------------------------------------
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(path.join(buildDir, 'index.html'))) throw new Error('run `pnpm build` in hud-react first');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf', '.json': 'application/json', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(buildDir, rel === '/' ? 'index.html' : rel));
  if (!file.startsWith(buildDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  fs.mkdirSync(args.out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(url);
    await page.waitForFunction('typeof window.setHudSample === "function"', { timeout: 15000 });
    await page.evaluate('document.fonts.ready.then(() => true)');
    const clip = { x: width - HUD_W, y: 0, width: HUD_W, height: HUD_H };
    const count = Math.ceil(duration * fps);
    for (let n = 0; n < count; n++) {
      const sample = sampleAt(n / fps);
      await page.evaluate(`window.setHudSample(${JSON.stringify(sample)}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      await page.screenshot({ path: path.join(args.out, `hud_${String(n).padStart(4, '0')}.png`), omitBackground: true, clip });
      if (n % 100 === 0) console.log(`captured ${n}/${count}`);
    }
    console.log(`captured ${count} HUD frames (${HUD_W}x${HUD_H}) in ${args.out}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
