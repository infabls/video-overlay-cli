// A GTA SA status bar: thick black frame, dark track, shaded fill (colors sampled from the reference HUD).
export type BarProps = {
  value: number; // 0..100
  kind: "health" | "armor";
  width: number;
  height: number;
};

const Bar = ({ value, kind, width, height }: BarProps) => {
  const border = Math.round(height * 0.2);
  const inner = height - border * 2;
  const fill = (Math.min(Math.max(value, 0), 100) / 100) * (width - border * 2);
  const id = `bar-${kind}`;
  const stops =
    kind === "health"
      ? ["#4a0b0d", "#9a1c20", "#b11a1f", "#c2131d", "#a61a1d", "#6c1b21", "#3a0508"]
      : ["#8d8b8e", "#dddbde", "#e6e4e7", "#eeecef", "#e2e0e3", "#b5b3b6", "#7a787b"];
  const track = kind === "health" ? "#3c0a0b" : "#727073";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map((c, i) => (
            <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.3" stopColor="#000" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="1.5" fill="#010101" />
      <rect x={border} y={border} width={width - border * 2} height={inner} fill={track} />
      <rect x={border} y={border} width={fill} height={inner} fill={`url(#${id})`} />
      <rect x={border} y={border} width={width - border * 2} height={inner} fill={`url(#${id}-shade)`} />
    </svg>
  );
};

export default Bar;
