// NFS Underground 2 HUD theme. Entry point: window.setHudSample(sample), see themes/capture.cjs.
// RPM and gear are cosmetic: derived from speed with a fixed gearbox model (a GPX has no engine data).
// Geometry and colors are measured from game screenshots and scaled to a 1080p frame.
(() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');

  // ---------- svg helpers: theta is degrees clockwise from 12 o'clock ----------
  const pol = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  };
  function el(parent, name, attrs = {}, text) {
    const node = document.createElementNS(SVGNS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }
  const arc = (r, from, to) => {
    const [x1, y1] = pol(r, from);
    const [x2, y2] = pol(r, to);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const line = (parent, r1, r2, deg, attrs) => {
    const [x1, y1] = pol(r1, deg);
    const [x2, y2] = pol(r2, deg);
    return el(parent, 'line', { x1, y1, x2, y2, ...attrs });
  };
  // polygon with rounded corners (radius r) through the given points
  function roundedPath(pts, r) {
    let d = '';
    pts.forEach((p, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const cut = (a, b) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const k = Math.min(r, len / 2) / len;
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      };
      const a = cut(p, prev);
      const b = cut(p, next);
      d += `${i ? 'L' : 'M'} ${a[0].toFixed(1)} ${a[1].toFixed(1)} Q ${p[0]} ${p[1]} ${b[0].toFixed(1)} ${b[1].toFixed(1)} `;
    });
    return `${d}Z`;
  }

  // ---------- Trax frame: dark glass with a stepped pale-lime border ----------
  {
    const svg = $('trax-frame');
    const W = 380, H = 162, TAB = 176, STEP = 18, i = 1.5;
    const pts = [[i, i], [TAB, i], [TAB + STEP, STEP + i], [W - i, STEP + i], [W - i, H - i], [i, H - i]];
    const defs = el(svg, 'defs');
    const g = el(defs, 'linearGradient', { id: 'traxFill', x1: 0, y1: 0, x2: 0, y2: 1 });
    el(g, 'stop', { offset: 0, 'stop-color': '#1a1c19', 'stop-opacity': 0.78 });
    el(g, 'stop', { offset: 0.5, 'stop-color': '#050605', 'stop-opacity': 0.76 });
    el(g, 'stop', { offset: 1, 'stop-color': '#000000', 'stop-opacity': 0.8 });
    const d = roundedPath(pts, 6);
    el(svg, 'path', { d, fill: 'url(#traxFill)' });
    el(svg, 'path', { d, fill: 'none', stroke: 'rgba(0,0,0,0.55)', 'stroke-width': 6 });
    el(svg, 'path', { d, fill: 'none', stroke: '#c6dea1', 'stroke-width': 3 });
  }

  // ---------- gauges ----------
  const gauge = $('gauge');
  {
    const defs = el(gauge, 'defs');
    const face = el(defs, 'radialGradient', { id: 'face', cx: 0.5, cy: 0.5, r: 0.5 });
    el(face, 'stop', { offset: 0, 'stop-color': '#030403', 'stop-opacity': 0.84 });
    el(face, 'stop', { offset: 0.72, 'stop-color': '#0b0c0a', 'stop-opacity': 0.72 });
    el(face, 'stop', { offset: 1, 'stop-color': '#1c1d1a', 'stop-opacity': 0.66 });
    const glass = el(defs, 'linearGradient', { id: 'glass', x1: 0.2, y1: 0, x2: 0.55, y2: 1 });
    el(glass, 'stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.13 });
    el(glass, 'stop', { offset: 0.42, 'stop-color': '#ffffff', 'stop-opacity': 0.03 });
    el(glass, 'stop', { offset: 0.48, 'stop-color': '#ffffff', 'stop-opacity': 0 });
    const cyan = el(defs, 'radialGradient', { id: 'cyan', cx: 0, cy: 0, r: 171, gradientUnits: 'userSpaceOnUse' });
    el(cyan, 'stop', { offset: 0.885, 'stop-color': '#12b9c6' });
    el(cyan, 'stop', { offset: 0.925, 'stop-color': '#2ff3f6' });
    el(cyan, 'stop', { offset: 0.97, 'stop-color': '#5ffbfb' });
    el(cyan, 'stop', { offset: 1, 'stop-color': '#1cc9d4' });
    const needleFill = el(defs, 'linearGradient', { id: 'needle', x1: 0, y1: 0, x2: 1, y2: 0 });
    el(needleFill, 'stop', { offset: 0, 'stop-color': '#e2e3e0' });
    el(needleFill, 'stop', { offset: 0.5, 'stop-color': '#b9bab7' });
    el(needleFill, 'stop', { offset: 1, 'stop-color': '#8e8f8c' });
    const shadow = el(defs, 'filter', { id: 'shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
    el(shadow, 'feDropShadow', { dx: 0, dy: 2, stdDeviation: 3, 'flood-color': '#000', 'flood-opacity': 0.45 });
    const txt = el(defs, 'filter', { id: 'txt', x: '-20%', y: '-20%', width: '140%', height: '140%' });
    el(txt, 'feDropShadow', { dx: 0, dy: 1.5, stdDeviation: 1.2, 'flood-color': '#000', 'flood-opacity': 0.75 });
    el(defs, 'path', { id: 'n2o-path', d: arc(156, 27, 75) });
  }

  // a glass dial: dark translucent face, rim and highlight
  function dial(parent, r) {
    el(parent, 'circle', { r: r + 3, fill: 'rgba(0,0,0,0.38)' });
    el(parent, 'circle', { r, fill: 'url(#face)' });
    el(parent, 'circle', { r: r - 1, fill: 'url(#glass)' });
    el(parent, 'circle', { r: r - 1.5, fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 1 });
  }
  function needleShape(parent, len, base, tail) {
    const g = el(parent, 'g', { filter: 'url(#shadow)' });
    el(g, 'polygon', {
      points: `-1.2,${-len} 1.2,${-len} ${base},6 ${base * 0.7},${tail} ${-base * 0.7},${tail} ${-base},6`,
      fill: 'url(#needle)', stroke: 'rgba(0,0,0,0.35)', 'stroke-width': 0.6,
    });
    return g;
  }
  function hub(parent, r) {
    el(parent, 'circle', { r, fill: '#131313', stroke: '#dcddda', 'stroke-width': r * 0.3 });
    el(parent, 'circle', { r: r * 0.32, fill: '#3a3a38' });
  }

  // small gauge: acceleration, -30..30 km/h per second, 0 points left
  const AUX = [-200, 74];
  const auxTheta = (v) => 270 + v * 4;
  const aux = el(gauge, 'g', { transform: `translate(${AUX[0]} ${AUX[1]})`, filter: 'url(#shadow)' });
  dial(aux, 68);
  el(aux, 'path', { d: arc(55, auxTheta(-32), auxTheta(32)), fill: 'none', stroke: 'rgba(255,255,245,0.09)', 'stroke-width': 13 });
  el(aux, 'path', { d: arc(55, auxTheta(20), auxTheta(32)), fill: 'none', stroke: 'rgba(190,44,54,0.9)', 'stroke-width': 13 });
  el(aux, 'path', { d: arc(55, auxTheta(-32), auxTheta(-20)), fill: 'none', stroke: 'rgba(190,44,54,0.9)', 'stroke-width': 13 });
  for (let v = -30; v <= 30; v += 7.5) line(aux, 50, 61, auxTheta(v), { stroke: '#f2f2f0', 'stroke-width': 3 });
  for (const [label, deg, r] of [['30', 52, 37], ['-30', 190, 38], ['0', 287, 41]]) {
    const [x, y] = pol(r, deg);
    el(aux, 'text', { class: 'aux-num', x, y, filter: 'url(#txt)' }, label);
  }
  const auxNeedle = needleShape(el(aux, 'g'), 60, 3.2, 12);
  hub(aux, 9);

  // main gauge: tachometer 0..9 (x1000 rpm), 0 at the bottom, clockwise
  const RPM0 = 180;
  const RPM_STEP = 25;
  const rpmTheta = (k) => RPM0 + k * RPM_STEP;
  const main = el(gauge, 'g', {});
  // N2O ring: dark bezel, beveled cyan band, small dark ticks on its inner edge, "N2O" lettering
  el(main, 'path', { d: arc(160, 257, 423), fill: 'none', stroke: 'rgba(0,0,0,0.5)', 'stroke-width': 30 });
  const mainDial = el(main, 'g', { filter: 'url(#shadow)' });
  dial(mainDial, 143);
  el(main, 'path', { d: arc(161, 260, 420), fill: 'none', stroke: 'url(#cyan)', 'stroke-width': 19, opacity: 0.9 });
  for (let a = 265; a <= 385; a += 12.5) line(main, 151.5, 159, a, { stroke: 'rgba(3,40,48,0.85)', 'stroke-width': 2.2 });
  const n2o = el(main, 'text', { class: 'n2o-text' });
  el(n2o, 'textPath', { href: '#n2o-path', startOffset: '0%' }, 'N2O');
  // tick band with red zone, major ticks, numbers
  el(main, 'path', { d: arc(124, 172, 420), fill: 'none', stroke: 'rgba(255,255,245,0.085)', 'stroke-width': 21 });
  el(main, 'path', { d: arc(124, rpmTheta(7.55), rpmTheta(9.4)), fill: 'none', stroke: 'rgba(185,40,50,0.9)', 'stroke-width': 21 });
  for (let k = 0; k <= 9; k++) {
    line(main, 114.5, 134, rpmTheta(k), { stroke: '#f4f4f2', 'stroke-width': 4 });
    const [x, y] = pol(100, rpmTheta(k));
    el(main, 'text', { class: 'num', x, y, filter: 'url(#txt)' }, String(k));
  }
  // inner "C" ring around the hub, open towards the digital readout
  el(main, 'circle', { r: 52, fill: 'rgba(0,0,0,0.28)' });
  el(main, 'path', { d: arc(63, 165, 400), fill: 'none', stroke: 'rgba(215,215,205,0.11)', 'stroke-width': 13 });
  // digital readout: gear, speed, unit
  const gearText = el(main, 'text', { class: 'gear', x: 114, y: -6, filter: 'url(#txt)' }, '1');
  const speedText = el(main, 'text', { class: 'speed', x: 118, y: 50, filter: 'url(#txt)' }, '0');
  const unitText = el(main, 'text', { class: 'unit', x: 116, y: 76, filter: 'url(#txt)' }, 'KM/H');
  const needle = needleShape(el(main, 'g'), 136, 4.2, 20);
  hub(main, 12);

  // ---------- speed -> rpm/gear ----------
  const KPH_PER_1000RPM = [0, 7.5, 12.5, 18, 24, 30.5, 38];
  const SHIFT_RPM = 7200;
  function drivetrain(kph) {
    let gear = 1;
    while (gear < 6 && (kph / KPH_PER_1000RPM[gear]) * 1000 > SHIFT_RPM) gear++;
    const rpm = Math.max(950, (kph / KPH_PER_1000RPM[gear]) * 1000);
    return { gear, rpm: Math.min(rpm, 9300) };
  }

  // ---------- radar ring with decorative markers ----------
  {
    const ring = $('ring');
    const defs = el(ring, 'defs');
    const vig = el(defs, 'radialGradient', { id: 'vignette', cx: 0.5, cy: 0.5, r: 0.5 });
    el(vig, 'stop', { offset: 0.78, 'stop-color': '#000', 'stop-opacity': 0 });
    el(vig, 'stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.35 });
    const matte = el(defs, 'radialGradient', { id: 'matte', cx: 0, cy: 0, r: 160, gradientUnits: 'userSpaceOnUse' });
    el(matte, 'stop', { offset: 0.84, 'stop-color': '#f0f2ea', 'stop-opacity': 0.36 });
    el(matte, 'stop', { offset: 0.92, 'stop-color': '#e2e5dc', 'stop-opacity': 0.27 });
    el(matte, 'stop', { offset: 1, 'stop-color': '#cfd2c8', 'stop-opacity': 0.33 });
    const sh = el(defs, 'filter', { id: 'mk', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    el(sh, 'feDropShadow', { dx: 0, dy: 1, stdDeviation: 1.2, 'flood-color': '#000', 'flood-opacity': 0.6 });
    el(ring, 'circle', { r: 135, fill: 'url(#vignette)' });
    el(ring, 'circle', { r: 147.5, fill: 'none', stroke: 'url(#matte)', 'stroke-width': 24 });
    el(ring, 'circle', { r: 135.5, fill: 'none', stroke: 'rgba(0,0,0,0.35)', 'stroke-width': 1.5 });
    el(ring, 'circle', { r: 136.8, fill: 'none', stroke: 'rgba(255,255,255,0.22)', 'stroke-width': 1 });
    el(ring, 'circle', { r: 159.5, fill: 'none', stroke: 'rgba(0,0,0,0.28)', 'stroke-width': 1.2 });
    const at = (deg, r = 148) => pol(r, deg);
    const ringDot = (deg, color) => {
      const [x, y] = at(deg);
      const g = el(ring, 'g', { transform: `translate(${x} ${y})`, filter: 'url(#mk)' });
      el(g, 'circle', { r: 11, fill: color, stroke: '#0b0b0b', 'stroke-width': 2 });
      el(g, 'circle', { r: 5.5, fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 2 });
      el(g, 'circle', { r: 2.6, fill: '#111' });
    };
    ringDot(316, '#8a35c9');
    ringDot(290, '#22a326');
    {
      const [x, y] = at(236, 146);
      const g = el(ring, 'g', { transform: `translate(${x} ${y}) rotate(236)`, filter: 'url(#mk)' });
      el(g, 'polygon', { points: '0,-16 13,9 -13,9', fill: 'rgba(214,126,52,0.8)', stroke: 'rgba(40,18,4,0.85)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
    }
    {
      const [x, y] = at(184, 150);
      const g = el(ring, 'g', { transform: `translate(${x} ${y})`, filter: 'url(#mk)' });
      el(g, 'circle', { r: 17, fill: 'none', stroke: 'rgba(70,160,255,0.85)', 'stroke-width': 3 });
      el(g, 'circle', { r: 11, fill: '#4fa19f', stroke: '#0c2626', 'stroke-width': 2.5 });
    }
  }

  // ---------- radar: OSM tiles reduced to the game's map (light roads, dark field, teal water) ----------
  const ZOOM = 17;
  const WORLD = 400;
  const map = $('map');
  const mctx = map.getContext('2d');
  const off = document.createElement('canvas');
  off.width = off.height = WORLD;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const tiles = new Map();

  function loadTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!tiles.has(key)) {
      tiles.set(key, new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `/__tile/${key}.png`;
      }));
    }
    return tiles.get(key);
  }
  const project = (lat, lon) => {
    const n = 2 ** ZOOM * 256;
    const s = Math.sin((lat * Math.PI) / 180);
    return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  };

  // binary morphology on WORLD x WORLD masks (square structuring element, separable)
  const N = WORLD * WORLD;
  const tmp = new Uint8Array(N);
  function morph(src, dst, r, grow) {
    for (let y = 0; y < WORLD; y++) {
      const row = y * WORLD;
      for (let x = 0; x < WORLD; x++) {
        let v = grow ? 0 : 1;
        for (let k = Math.max(0, x - r), e = Math.min(WORLD - 1, x + r); k <= e; k++) {
          if (grow ? src[row + k] : !src[row + k]) { v = grow ? 1 : 0; break; }
        }
        tmp[row + x] = v;
      }
    }
    for (let x = 0; x < WORLD; x++) {
      for (let y = 0; y < WORLD; y++) {
        let v = grow ? 0 : 1;
        for (let k = Math.max(0, y - r), e = Math.min(WORLD - 1, y + r); k <= e; k++) {
          if (grow ? tmp[k * WORLD + x] : !tmp[k * WORLD + x]) { v = grow ? 1 : 0; break; }
        }
        dst[y * WORLD + x] = v;
      }
    }
    return dst;
  }
  // drop connected components smaller than minArea (label halos, isolated bits)
  const stack = new Int32Array(N);
  const seen = new Uint8Array(N);
  function dropSmall(mask, minArea) {
    seen.fill(0);
    const comp = [];
    for (let i = 0; i < N; i++) {
      if (!mask[i] || seen[i]) continue;
      let sp = 0;
      comp.length = 0;
      stack[sp++] = i;
      seen[i] = 1;
      while (sp) {
        const p = stack[--sp];
        comp.push(p);
        const x = p % WORLD;
        if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < WORLD - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (p >= WORLD && mask[p - WORLD] && !seen[p - WORLD]) { seen[p - WORLD] = 1; stack[sp++] = p - WORLD; }
        if (p < N - WORLD && mask[p + WORLD] && !seen[p + WORLD]) { seen[p + WORLD] = 1; stack[sp++] = p + WORLD; }
      }
      if (comp.length < minArea) for (const p of comp) mask[p] = 0;
    }
    return mask;
  }
  // 3x3 box blur of a 0/1 mask into 0..1 coverage (anti-aliased edges)
  function soften(mask, out) {
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= WORLD) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= WORLD) continue;
            s += mask[yy * WORLD + xx];
            c++;
          }
        }
        out[y * WORLD + x] = s / c;
      }
    }
    return out;
  }

  // grow seeds through 4-connected pixels of mask (morphological reconstruction), in place on seeds
  function reconstruct(seeds, mask) {
    let sp = 0;
    for (let i = 0; i < N; i++) if (seeds[i]) stack[sp++] = i;
    while (sp) {
      const p = stack[--sp];
      const x = p % WORLD;
      if (x > 0 && mask[p - 1] && !seeds[p - 1]) { seeds[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < WORLD - 1 && mask[p + 1] && !seeds[p + 1]) { seeds[p + 1] = 1; stack[sp++] = p + 1; }
      if (p >= WORLD && mask[p - WORLD] && !seeds[p - WORLD]) { seeds[p - WORLD] = 1; stack[sp++] = p - WORLD; }
      if (p < N - WORLD && mask[p + WORLD] && !seeds[p + WORLD]) { seeds[p + WORLD] = 1; stack[sp++] = p + WORLD; }
    }
    return seeds;
  }
  // set enclosed background islands smaller than maxArea
  const inv = new Uint8Array(N);
  function fillHoles(mask, maxArea) {
    for (let p = 0; p < N; p++) inv[p] = mask[p] ? 0 : 1;
    dropSmall(inv, maxArea);
    for (let p = 0; p < N; p++) mask[p] = inv[p] ? 0 : 1;
    return mask;
  }

  const road = new Uint8Array(N), water = new Uint8Array(N), ground = new Uint8Array(N), bldg = new Uint8Array(N);
  const a1 = new Uint8Array(N), a2 = new Uint8Array(N), casing = new Uint8Array(N);
  const roadCov = new Float32Array(N), casingCov = new Float32Array(N), waterCov = new Float32Array(N), covTmp = new Float32Array(N);
  // output colors [r, g, b, alpha 0..1]
  const C_GROUND = [22, 28, 32, 0.5];
  const C_BLDG = [40, 46, 52, 0.55];
  const C_WATER = [20, 72, 88, 0.72];
  const C_CASING = [6, 8, 10, 0.5];
  const C_ROAD = [184, 191, 188, 0.96];

  function recolor(img) {
    const d = img.data;
    for (let i = 0, p = 0; p < N; i += 4, p++) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const chroma = max - min;
      const luma = (299 * r + 587 * g + 114 * b) / 1000;
      road[p] = water[p] = ground[p] = bldg[p] = 0;
      if (b > g + 8 && g > r + 14) water[p] = 1; // #aad3df
      else if (luma >= 244 && chroma < 12) road[p] = 1; // white roads (and label halos, removed below)
      else if (r >= 225 && g >= 140 && luma > 165 && r - b >= 25 && g <= r + 6) road[p] = 1; // primary, secondary, trunk (not #fa8072 footways)
      else if (chroma >= 5 && luma >= 195 && luma < 226 && r >= g && g >= b) bldg[p] = ground[p] = 1; // #d9d0c9 buildings
      else if ((luma >= 226 && chroma < 18) || (g > r + 10 && g > b)) ground[p] = 1; // background #f2efe9, parking, parks
    }
    // Label halos are white like roads, but a halo always touches the map background, while a road is
    // separated from it by its casing. Seed roads with white pixels away from the background, then grow
    // the seeds back through connected road pixels: halos that are not attached to a road disappear.
    morph(ground, a1, 2, true);
    for (let p = 0; p < N; p++) a2[p] = road[p] && !a1[p] ? 1 : 0;
    reconstruct(a2, road);
    road.set(a2);
    // street names, rails and arrows printed on roads leave holes: fill small enclosed gaps
    // rails, text and arrows across a road: close gaps up to ~8px over anything that is not background or water
    morph(morph(road, a1, 4, true), a2, 4, false);
    for (let p = 0; p < N; p++) if (a2[p] && !ground[p] && !water[p]) road[p] = 1;
    fillHoles(road, 260);
    morph(morph(road, a1, 1, false), road, 1, true);
    fillHoles(road, 60);
    dropSmall(road, 120);
    // the game's streets are thinner and plainer than OSM's: shave 1px off wide roads, keep narrow lanes whole
    morph(morph(road, a1, 2, false), a2, 2, true); // a2: roads at least 5px wide
    morph(road, a1, 1, false);
    for (let p = 0; p < N; p++) if (a2[p]) road[p] = a1[p];
    // water: close holes left by labels, drop specks
    morph(morph(water, a1, 3, true), water, 3, false);
    fillHoles(water, 600);
    dropSmall(water, 400);
    // casing: a soft dark outline around roads
    morph(road, casing, 1, true);
    soften(soften(road, covTmp), roadCov);
    soften(soften(casing, covTmp), casingCov);
    soften(water, waterCov);
    morph(bldg, a2, 1, false);
    for (let i = 0, p = 0; p < N; i += 4, p++) {
      // composite: ground/building/water, then casing, then road (premultiplied "over")
      let base = a2[p] ? C_BLDG : C_GROUND;
      let cr = base[0], cg = base[1], cb = base[2], ca = base[3];
      const layer = (c, k) => {
        const a = c[3] * k;
        if (a <= 0) return;
        const outA = a + ca * (1 - a);
        cr = (c[0] * a + cr * ca * (1 - a)) / outA;
        cg = (c[1] * a + cg * ca * (1 - a)) / outA;
        cb = (c[2] * a + cb * ca * (1 - a)) / outA;
        ca = outA;
      };
      layer(C_WATER, waterCov[p]);
      layer(C_CASING, casingCov[p]);
      layer(C_ROAD, roadCov[p]);
      d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = Math.round(ca * 255);
    }
  }

  // ?map=vector draws the radar from vector tiles instead (see map-style.js)
  const vectorMap = new URLSearchParams(window.location.search).get('map') === 'vector'
    ? window.createVectorMap(map, window.mapStyle)
    : null;

  let lastKey = '';
  async function drawMap(lat, lon, heading) {
    if (vectorMap) return vectorMap(lat, lon, heading);
    const [px, py] = project(lat, lon);
    const key = `${Math.round(px)},${Math.round(py)}`;
    if (key !== lastKey) {
      lastKey = key;
      const x0 = Math.floor((px - WORLD / 2) / 256), x1 = Math.floor((px + WORLD / 2) / 256);
      const y0 = Math.floor((py - WORLD / 2) / 256), y1 = Math.floor((py + WORLD / 2) / 256);
      const jobs = [];
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) jobs.push(loadTile(ZOOM, tx, ty).then((img) => [tx, ty, img]));
      const loaded = await Promise.all(jobs);
      octx.fillStyle = '#f2efe9';
      octx.fillRect(0, 0, WORLD, WORLD);
      for (const [tx, ty, img] of loaded) if (img) octx.drawImage(img, Math.round(tx * 256 - px + WORLD / 2), Math.round(ty * 256 - py + WORLD / 2));
      const data = octx.getImageData(0, 0, WORLD, WORLD);
      recolor(data);
      octx.putImageData(data, 0, 0);
    }
    const c = map.width / 2;
    mctx.save();
    mctx.clearRect(0, 0, map.width, map.height);
    mctx.translate(c, c);
    mctx.rotate((-heading * Math.PI) / 180);
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(off, -WORLD / 2, -WORLD / 2);
    mctx.restore();
  }

  // ---------- frame update ----------
  let topSpeed = 0;
  window.setHudSample = async (s) => {
    const mph = s.unit === 'mph';
    const k = mph ? 0.621371 : 1;
    const speed = s.speedKph * k;
    const { gear, rpm } = drivetrain(s.speedKph);
    speedText.textContent = String(Math.round(speed));
    unitText.textContent = mph ? 'MPH' : 'KM/H';
    gearText.textContent = String(gear);
    needle.setAttribute('transform', `rotate(${rpmTheta(rpm / 1000)})`);
    auxNeedle.setAttribute('transform', `rotate(${auxTheta(Math.max(-30, Math.min(30, s.accelKph ?? 0)))})`);
    topSpeed = Math.max(topSpeed, speed);
    $('topspeed-value').textContent = `+${Math.round(topSpeed)}`;
    $('bank-value').textContent = (s.distanceKm * k).toFixed(2);
    $('bank-unit').textContent = mph ? 'mi' : 'km';
    $('trax-clock').textContent = `${pad(s.hour)}:${pad(s.minute)}`;
    $('trax-elapsed').textContent = `${pad(s.elapsed / 60)}:${pad(s.elapsed % 60)}`;
    $('trax-avg').textContent = s.elapsed > 1 ? String(Math.round((s.distanceKm * k) / (s.elapsed / 3600))) : '0';
    $('trax-avg-unit').textContent = mph ? 'mph' : 'km/h';
    if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) await drawMap(s.lat, s.lon, s.heading || 0);
  };
})();
