// Vector radar style for the gta-sa theme (-Map vector). Palette matches
// internal/render/widgets/gta_map_style.go (sampled from the game); format: themes/shared/vector-map.js.
window.mapStyle = {
  zoom: 16,
  ground: 'rgb(178, 178, 176)',
  park: { color: 'rgb(57, 105, 41)', alpha: 1 },
  water: { color: 'rgb(78, 110, 150)', alpha: 1 },
  waterway: { color: 'rgb(78, 110, 150)', alpha: 1, width: 5 },
  building: { color: 'rgb(236, 235, 233)', alpha: 1 },
  casing: null,
  road: { color: 'rgb(16, 16, 16)', alpha: 1 },
  widths: {
    motorway: 20, trunk: 19, primary: 18, secondary: 15, tertiary: 13,
    minor: 10, busway: 8, service: 6, track: 4,
  },
};
