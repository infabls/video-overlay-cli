// Vector map tiles (OpenMapTiles schema) for overlay themes: downloads .pbf tiles, caches them on
// disk and returns only the geometry a game-style map needs, as plain JSON.
//
//   { extent, water: [[ring, ...], ...], waterway: [line, ...], building: [[ring, ...], ...],
//     park: [[ring, ...], ...], roads: [{ c: "primary", l: [line, ...] }] }
//
// ring and line are flat arrays [x0, y0, x1, y1, ...] in tile units (0..extent, plus a buffer).
// Default source: OpenFreeMap (no API key). Attribution: OpenFreeMap, (c) OpenMapTiles,
// data (c) OpenStreetMap contributors.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const Pbf = require('pbf');
const { VectorTile } = require('@mapbox/vector-tile');

const DEFAULT_TILEJSON = 'https://tiles.openfreemap.org/planet';
const userAgent = 'overlay-theme-capture/1.0';

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': userAgent }, timeout: 20000 }, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 204) { res.resume(); reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve(body[0] === 0x1f && body[1] === 0x8b ? zlib.gunzipSync(body) : body);
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout for ${url}`)));
    req.on('error', reject);
  });
}

const flat = (points) => points.flatMap((p) => [p.x, p.y]);

function decode(buffer) {
  const layers = new VectorTile(new Pbf(buffer)).layers;
  const out = { extent: 4096, water: [], waterway: [], building: [], park: [], roads: [] };
  const each = (name, type, fn) => {
    const layer = layers[name];
    if (!layer) return;
    out.extent = layer.extent;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      if (feature.type === type) fn(feature.loadGeometry().map(flat), feature.properties);
    }
  };
  const POINT_LINE = 2;
  const POLYGON = 3;
  each('water', POLYGON, (g) => out.water.push(g));
  each('waterway', POINT_LINE, (g) => out.waterway.push(...g));
  each('building', POLYGON, (g) => out.building.push(g));
  each('park', POLYGON, (g) => out.park.push(g));
  each('landcover', POLYGON, (g, p) => { if (p.class === 'wood' || p.class === 'grass') out.park.push(g); });
  each('transportation', POINT_LINE, (g, p) => out.roads.push({ c: p.class, l: g }));
  return out;
}

// createVectorTiles returns get(z, x, y) -> Promise of the decoded tile.
function createVectorTiles({ cacheDir, tileJson = DEFAULT_TILEJSON }) {
  let template = null; // tile URL template from the TileJSON, fetched once
  const decoded = new Map();
  fs.mkdirSync(cacheDir, { recursive: true });

  async function load(z, x, y) {
    const file = path.join(cacheDir, `${z}_${x}_${y}.pbf`);
    if (fs.existsSync(file)) return decode(fs.readFileSync(file));
    template ??= download(tileJson).then((body) => JSON.parse(body.toString('utf8')).tiles[0]);
    const url = (await template).replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const body = await download(url);
    fs.writeFileSync(file, body);
    return decode(body);
  }

  return function get(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!decoded.has(key)) {
      decoded.set(key, load(z, x, y).catch((error) => {
        decoded.delete(key);
        template = null;
        throw error;
      }));
    }
    return decoded.get(key);
  };
}

module.exports = { createVectorTiles, decode };
