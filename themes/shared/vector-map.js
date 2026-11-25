// Draws a rotated game-style minimap from vector tiles served by capture.cjs
// (/__vtile/{z}/{x}/{y}.json). The look comes entirely from the style object:
//
//   {
//     zoom: 17,                       // map scale, as raster zoom levels (data is taken from zoom <= 14)
//     ground: '#161c20',              // background, or null
//     park / water / building:        // { color, alpha } or null to skip
//     waterway: { color, alpha, width },
//     casing: { color, alpha, extra },// outline around roads, extra = added width in px
//     road: { color, alpha },
//     widths: { primary: 20, ... },   // px per OpenMapTiles road class; classes not listed are hidden
//   }
//
// window.createVectorMap(canvas, style) -> draw(lat, lon, heading): Promise
(() => {
  const DATA_ZOOM = 14;

  window.createVectorMap = (canvas, style) => {
    const ctx = canvas.getContext('2d');
    const scratch = document.createElement('canvas');
    scratch.width = canvas.width;
    scratch.height = canvas.height;
    const sctx = scratch.getContext('2d');
    const tileZoom = Math.min(DATA_ZOOM, Math.floor(style.zoom));
    const tileSize = 256 * 2 ** (style.zoom - tileZoom); // px on screen
    const tiles = new Map();

    const path = (parts, scale, close) => {
      const p = new Path2D();
      for (const a of parts) {
        p.moveTo(a[0] * scale, a[1] * scale);
        for (let i = 2; i < a.length; i += 2) p.lineTo(a[i] * scale, a[i + 1] * scale);
        if (close) p.closePath();
      }
      return p;
    };

    function prepare(data) {
      const scale = tileSize / data.extent;
      const roads = new Map(); // class -> Path2D
      for (const { c, l } of data.roads) {
        if (!style.widths[c]) continue;
        if (!roads.has(c)) roads.set(c, new Path2D());
        roads.get(c).addPath(path(l, scale, false));
      }
      return {
        park: data.park.map((rings) => path(rings, scale, true)),
        water: data.water.map((rings) => path(rings, scale, true)),
        building: data.building.map((rings) => path(rings, scale, true)),
        waterway: path(data.waterway, scale, false),
        // narrow roads first, so wide ones are painted over them
        roads: [...roads].sort((a, b) => style.widths[a[0]] - style.widths[b[0]]),
      };
    }

    function load(x, y) {
      const key = `${tileZoom}/${x}/${y}`;
      if (!tiles.has(key)) {
        tiles.set(key, fetch(`/__vtile/${key}.json`)
          .then((r) => { if (!r.ok) throw new Error(`tile ${key}: HTTP ${r.status}`); return r.json(); })
          .then(prepare)
          .catch((error) => { tiles.delete(key); throw error; }));
      }
      return tiles.get(key).then((t) => [x, y, t]);
    }

    return async function draw(lat, lon, heading) {
      const world = 256 * 2 ** style.zoom;
      const sin = Math.sin((lat * Math.PI) / 180);
      const px = ((lon + 180) / 360) * world;
      const py = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world;
      // the canvas rotates, so load everything within its half diagonal
      const reach = Math.hypot(canvas.width, canvas.height) / 2 + 24;
      const jobs = [];
      for (let ty = Math.floor((py - reach) / tileSize); ty <= Math.floor((py + reach) / tileSize); ty++) {
        for (let tx = Math.floor((px - reach) / tileSize); tx <= Math.floor((px + reach) / tileSize); tx++) jobs.push(load(tx, ty));
      }
      const visible = await Promise.all(jobs);

      // Each layer is painted opaque on a scratch canvas and composited once, so that overlapping
      // shapes (road joints, tile buffers) do not add up their transparency.
      const layer = (alpha, paint) => {
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, scratch.width, scratch.height);
        sctx.translate(canvas.width / 2, canvas.height / 2);
        sctx.rotate((-heading * Math.PI) / 180);
        sctx.translate(-px, -py);
        for (const [x, y, t] of visible) {
          sctx.save();
          sctx.translate(x * tileSize, y * tileSize);
          paint(t);
          sctx.restore();
        }
        ctx.globalAlpha = alpha;
        ctx.drawImage(scratch, 0, 0);
        ctx.globalAlpha = 1;
      };
      const polygons = (name) => {
        const s = style[name];
        if (!s) return;
        layer(s.alpha, (t) => {
          sctx.fillStyle = s.color;
          for (const p of t[name]) sctx.fill(p, 'evenodd');
        });
      };
      const roads = (s, extra) => layer(s.alpha, (t) => {
        sctx.strokeStyle = s.color;
        sctx.lineCap = 'round';
        sctx.lineJoin = 'round';
        for (const [name, p] of t.roads) {
          sctx.lineWidth = style.widths[name] + extra;
          sctx.stroke(p);
        }
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (style.ground) {
        ctx.fillStyle = style.ground;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      polygons('park');
      polygons('water');
      if (style.waterway) {
        layer(style.waterway.alpha, (t) => {
          sctx.strokeStyle = style.waterway.color;
          sctx.lineWidth = style.waterway.width;
          sctx.stroke(t.waterway);
        });
      }
      polygons('building');
      if (style.casing) roads(style.casing, style.casing.extra);
      roads(style.road, 0);
    };
  };
})();
