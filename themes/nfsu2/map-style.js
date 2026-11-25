// Vector minimap style (used with --map vector / -Map vector). Same palette as the raster radar in
// theme.js; format is described in themes/shared/vector-map.js.
window.mapStyle = {
  zoom: 17,
  ground: 'rgba(22, 28, 32, 0.5)',
  park: null,
  water: { color: 'rgb(20, 72, 88)', alpha: 0.8 },
  waterway: { color: 'rgb(20, 72, 88)', alpha: 0.8, width: 5 },
  building: { color: 'rgb(52, 60, 68)', alpha: 0.55 },
  casing: { color: 'rgb(6, 8, 10)', alpha: 0.6, extra: 5 },
  road: { color: 'rgb(184, 191, 188)', alpha: 0.96 },
  widths: {
    motorway: 22, trunk: 21, primary: 19, secondary: 16, tertiary: 14,
    minor: 10, busway: 8, service: 5, track: 3,
  },
};
