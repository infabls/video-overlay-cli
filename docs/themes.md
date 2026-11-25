# Overlay themes (HTML / CSS / JS)

A theme is a static web page that draws a game-style HUD. `themes/capture.cjs` opens it in headless Chrome, feeds it one telemetry sample per frame from a GPX track, and saves transparent PNGs; `scripts/build-overlay.ps1` composites them over the video with ffmpeg in a single encode.

| Theme | Where | Notes |
| --- | --- | --- |
| `nfsu2` | `themes/nfsu2/` | Need for Speed: Underground 2 - tachometer with N2O ring, speed (km/h by default, `-Units mph` optional) and gear, small acceleration gauge, circular minimap (OSM tiles reduced to roads and water, labels removed), Bank-style distance box, Trax-style clock box, top-speed call-out. Full-frame, draws its own minimap. Colors are sampled from game screenshots. |
| `gta-sa` | `hud-react/` + `layouts/gta-sa.xml` | See [gta-sa.md](gta-sa.md). Corner HUD from a React app, radar from the Go renderer. |

```powershell
.\scripts\build-overlay.ps1 -Theme nfsu2 -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx .\tracks\track.gpx -Output .\renders\nfsu2.mp4
```

Parameters: `-Theme`, `-Map raster|vector` (nfsu2 only, see below), `-Units kph|mph`, `-Offset`, `-TzHours`, `-Limit` (first N seconds, for checks), `-Stars` (GTA themes), `-Layout` (also render a Go radar layer from this XML, any theme), `-Fps`, `-Width`, `-Height`. Needs `ffmpeg`/`ffprobe`, Node, `pnpm` and Chrome; the first run installs `themes/` dependencies.

## Making a theme

Create `themes/<name>/` with:

- `index.html` (plus any css/js/images) that defines `window.setHudSample(sample)`. It may return a Promise (for example to wait for map tiles); the frame is captured after it settles.
- `theme.json` (optional): `{ "name": "...", "clip": null }` captures the whole frame; `{ "clip": { "anchor": "top-right", "width": 540, "height": 290 } }` captures only that corner, which keeps the PNGs small. `anchor` is any of `top-left`, `top-right`, `bottom-left`, `bottom-right`.
- Transparent page background (`html, body { background: transparent }`). Layout is in pixels of the output frame (1920x1080 by default).

The sample:

| Field | Meaning |
| --- | --- |
| `speedKph`, `accelKph` | speed and its change per second (from consecutive GPX points) |
| `distanceKm`, `elapsed` | distance so far, seconds since the start |
| `hour`, `minute` | GPX clock + `-TzHours`, 12-hour |
| `lat`, `lon`, `heading` | position and travel direction in degrees (smoothed) |
| `unit`, `wanted` | `kph`/`mph` and GTA star count |

Map tiles: request `/__tile/{z}/{x}/{y}.png` from the page; the capture server proxies it to OpenStreetMap (`--tile-url` to change), identifies itself with a User-Agent, and caches tiles on disk. Respect the tile provider's usage policy.

## Vector minimap (trial)

`-Map vector` (capture: `--map vector`) draws the `nfsu2` radar from vector tiles instead of recoloring raster tiles: no label leftovers, road width set per road class, divided roads shown as two carriageways. The default stays `raster`.

```powershell
.\scripts\build-overlay.ps1 -Theme nfsu2 -Map vector -Video E:\DCIM\100GOPRO\GX015729.MP4 -Gpx .\tracks\track.gpx -Output .\renders\nfsu2-vector.mp4
```

- The look is one style object: `themes/nfsu2/map-style.js` (colors, opacity, width per road class, zoom).
- `themes/shared/vector-map.js` is the theme-independent renderer (`window.createVectorMap(canvas, style)`); the capture server serves it as `/__shared/vector-map.js`.
- Tiles come from `/__vtile/{z}/{x}/{y}.json`: `themes/vector-tiles.cjs` downloads OpenMapTiles-schema `.pbf` tiles (default [OpenFreeMap](https://openfreemap.org), no API key; `--vtile-url` takes another TileJSON), caches them and returns only the geometry. Data is available up to zoom 14 and scaled up from there.
- Attribution for published videos: OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors.

Try a theme without a video: `node themes/capture.cjs --theme themes/nfsu2 --gpx tracks/track.gpx --out out --duration 3 --fps 10`.

## Caveats

- RPM and gear in `nfsu2` are cosmetic: a fixed gearbox model driven by speed. A GPX has no engine data.
- Speed and distance come from the track. A GPX with invented timestamps shows invented speeds.
- The NFS look is drawn from reference screenshots with CSS/SVG; no EA assets are used or redistributed.
