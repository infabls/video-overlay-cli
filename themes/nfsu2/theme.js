// NFS Underground 2 HUD theme. Entry point: window.setHudSample(sample), see themes/capture.cjs.
// RPM and gear are cosmetic: derived from speed with a fixed gearbox model (a GPX has no engine data).
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

  // ---------- main gauge ----------
  const RPM0 = 215; // theta of 0 rpm
  const RPM_STEP = 23.3; // degrees per 1000 rpm
  const rpmTheta = (k) => RPM0 + k * RPM_STEP;
  const gauge = $('gauge');
  el(gauge, 'path', { class: 'n2o', d: arc(180, 235, 455) });
  const [tx, ty] = pol(178, 438);
  el(gauge, 'text', { class: 'n2o-text', transform: `translate(${tx} ${ty}) rotate(${438 + 90 - 180})`, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'N2O');
  el(gauge, 'circle', { class: 'face', r: 165 });
  el(gauge, 'path', { class: 'redzone', d: arc(150, rpmTheta(8), rpmTheta(9.3)) });
  for (let k = 0; k <= 9.5; k += 0.5) {
    const major = Number.isInteger(k);
    const [x1, y1] = pol(major ? 138 : 146, rpmTheta(k));
    const [x2, y2] = pol(154, rpmTheta(k));
    el(gauge, 'line', { class: major ? 'tick' : 'tick minor', x1, y1, x2, y2 });
    if (major) {
      const [nx, ny] = pol(112, rpmTheta(k));
      el(gauge, 'text', { class: 'num', x: nx, y: ny }, String(k));
    }
  }
  el(gauge, 'circle', { class: 'hub', r: 38 });
  const needle = el(gauge, 'g', {});
  el(needle, 'line', { class: 'needle', x1: 0, y1: 22, x2: 0, y2: -136 });
  el(gauge, 'circle', { class: 'cap', r: 10 });

  // ---------- small gauge (acceleration, -30..30 km/h per second) ----------
  const aux = $('aux');
  const auxTheta = (v) => 270 + v * 3.67;
  el(aux, 'circle', { class: 'face', r: 70 });
  el(aux, 'path', { class: 'redzone', d: arc(60, auxTheta(18), auxTheta(30)), 'stroke-width': 6 });
  el(aux, 'path', { class: 'redzone', d: arc(60, auxTheta(-30), auxTheta(-18)), 'stroke-width': 6 });
  for (const v of [-30, -15, 0, 15, 30]) {
    const [x1, y1] = pol(50, auxTheta(v));
    const [x2, y2] = pol(58, auxTheta(v));
    el(aux, 'line', { class: 'tick', x1, y1, x2, y2, 'stroke-width': 2 });
  }
  for (const v of [-30, 0, 30]) {
    const [x, y] = pol(34, auxTheta(v));
    el(aux, 'text', { class: 'aux-num', x, y }, String(v));
  }
  const auxNeedle = el(aux, 'g', {});
  el(auxNeedle, 'line', { class: 'aux-needle', x1: 0, y1: 10, x2: 0, y2: -52 });
  el(aux, 'circle', { class: 'cap', r: 7 });

  // ---------- speed -> rpm/gear ----------
  const KPH_PER_1000RPM = [0, 7, 12, 18, 25, 32, 40];
  function drivetrain(kph) {
    let gear = 1;
    while (gear < 6 && (kph / KPH_PER_1000RPM[gear]) * 1000 > 7600) gear++;
    const rpm = Math.max(900, (kph / KPH_PER_1000RPM[gear]) * 1000);
    return { gear, rpm: Math.min(rpm, 9300) };
  }

  // ---------- radar: OSM tiles recolored to the game's dark map ----------
  const ZOOM = 17;
  const WORLD = 420;
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
  function recolor(img) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const luma = (299 * r + 587 * g + 114 * b) / 1000;
      let c;
      if (b > g + 8 && g > r + 14) c = [46, 94, 120]; // water
      else if (g > r + 8 && g > b + 8 && g > 95) c = [40, 68, 60]; // parks
      else if (r > g + 8 && g > b + 25 && luma > 190) c = [214, 218, 222]; // major roads
      else if (r > g + 18) c = [40, 48, 60]; // footpaths: drop into the ground
      else if (luma < 150) c = [40, 48, 60]; // labels
      else if (luma >= 250 && chroma < 8) c = [214, 218, 222]; // road surface
      else if (luma >= 228) c = [40, 48, 60]; // open ground
      else if (chroma >= 12) c = [56, 65, 79]; // buildings
      else c = [26, 31, 40]; // road edges
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  async function drawMap(lat, lon, heading) {
    const [px, py] = project(lat, lon);
    const x0 = Math.floor((px - WORLD / 2) / 256), x1 = Math.floor((px + WORLD / 2) / 256);
    const y0 = Math.floor((py - WORLD / 2) / 256), y1 = Math.floor((py + WORLD / 2) / 256);
    const jobs = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) jobs.push(loadTile(ZOOM, tx, ty).then((img) => [tx, ty, img]));
    const loaded = await Promise.all(jobs);
    octx.fillStyle = '#28303c';
    octx.fillRect(0, 0, WORLD, WORLD);
    for (const [tx, ty, img] of loaded) if (img) octx.drawImage(img, Math.round(tx * 256 - px + WORLD / 2), Math.round(ty * 256 - py + WORLD / 2));
    const data = octx.getImageData(0, 0, WORLD, WORLD);
    recolor(data);
    octx.putImageData(data, 0, 0);
    const c = map.width / 2;
    mctx.save();
    mctx.clearRect(0, 0, map.width, map.height);
    mctx.translate(c, c);
    mctx.rotate((-heading * Math.PI) / 180);
    mctx.drawImage(off, -WORLD / 2, -WORLD / 2);
    mctx.restore();
  }

  // ---------- frame update ----------
  let topSpeed = 0;
  window.setHudSample = async (s) => {
    const mph = s.unit === 'mph';
    const speed = mph ? s.speedKph * 0.621371 : s.speedKph;
    const { gear, rpm } = drivetrain(s.speedKph);
    $('speed').textContent = String(Math.round(speed));
    $('unit').textContent = mph ? 'MPH' : 'KM/H';
    $('gear').textContent = String(gear);
    needle.setAttribute('transform', `rotate(${rpmTheta(rpm / 1000)})`);
    auxNeedle.setAttribute('transform', `rotate(${auxTheta(Math.max(-30, Math.min(30, s.accelKph ?? 0)))})`);
    topSpeed = Math.max(topSpeed, speed);
    $('topspeed-value').textContent = `+${Math.round(topSpeed)}`;
    $('bank-value').textContent = (mph ? s.distanceKm * 0.621371 : s.distanceKm).toFixed(2);
    document.querySelector('#bank small').textContent = mph ? 'mi' : 'km';
    $('trax-clock').textContent = `${pad(s.hour)}:${pad(s.minute)}`;
    $('trax-elapsed').textContent = `${pad(s.elapsed / 60)}:${pad(s.elapsed % 60)}`;
    if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) await drawMap(s.lat, s.lon, s.heading || 0);
  };
})();
