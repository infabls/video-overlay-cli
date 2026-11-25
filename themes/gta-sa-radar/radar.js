// San Andreas radar: heading-up vector map, with the north letter travelling around the black ring.
(() => {
  const CENTER = [214, 875];
  const NORTH_RADIUS = 166;
  const draw = window.createVectorMap(document.getElementById('map'), window.mapStyle);
  const north = document.getElementById('north');

  window.setHudSample = async (s) => {
    const heading = s.heading || 0;
    const angle = (-heading * Math.PI) / 180;
    north.setAttribute('x', (CENTER[0] + NORTH_RADIUS * Math.sin(angle)).toFixed(2));
    // baseline sits below the point on the ring, so the letter is centered on it
    north.setAttribute('y', (CENTER[1] - NORTH_RADIUS * Math.cos(angle) + 14).toFixed(2));
    if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) await draw(s.lat, s.lon, heading);
  };
})();
