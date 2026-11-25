import { useEffect, useState } from "react";
import Bar from "./Bar";
import Time from "./Time";
import Outlined from "./Outlined";

type HudSample = { hour: number; minute: number; speedKph: number; distanceKm: number; wanted?: number; unit?: "kph" | "mph" };

// Layout of the top-right cluster (px). Colors are sampled from assets/reference/gtasahud.jpg:
// clock #d9dbd8, health #b11a1f, armor #e6e4e7 on #727073, money green #6d8c00, stars #ffd400,
// black outlines ~9% of the glyph height, bar frames ~20% of the bar height.
const COLUMN = 262; // clock and bars
const ICON = 120;
const GAP = 12;
const WIDTH = ICON + GAP + COLUMN;
const BAR_H = 24;

// five-pointed star, fat arms like the game's wanted stars
const starPoints = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const k = i % 2 ? r * 0.49 : r;
    return `${(cx + k * Math.cos(a)).toFixed(2)},${(cy + k * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

const STAR = 50;
const Stars = ({ active }: { active: number }) => (
  <svg width={STAR * 6 + 2 * 5} height={STAR} viewBox={`0 0 ${STAR * 6 + 10} ${STAR}`} className="block" overflow="visible">
    <defs>
      <linearGradient id="star-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff07a" />
        <stop offset="0.32" stopColor="#ffd400" />
        <stop offset="0.8" stopColor="#ffd000" />
        <stop offset="1" stopColor="#e2b100" />
      </linearGradient>
    </defs>
    {Array.from({ length: 6 }, (_, i) => {
      const lit = i >= 6 - active; // stars light up from the right, as in the game
      return (
        <polygon
          key={i}
          points={starPoints(i * (STAR + 2) + STAR / 2, STAR / 2 + 2, STAR / 2 - 1)}
          fill={lit ? "url(#star-gold)" : "rgba(20,20,20,0.55)"}
          stroke="#000"
          strokeWidth={lit ? 4 : 3.5}
          strokeLinejoin="miter"
          strokeMiterlimit={6}
        />
      );
    })}
  </svg>
);

declare global { interface Window { setHudSample?: (sample: HudSample) => void } }

const Hud = () => {
  const [sample, setSample] = useState<HudSample>({ hour: 4, minute: 55, speedKph: 0, distanceKm: 0 });
  useEffect(() => { window.setHudSample = setSample; return () => { delete window.setHudSample; }; }, []);
  const mph = sample.unit === "mph";
  const k = mph ? 0.621371 : 1;
  return (
    <div className="hud-anchor select-none" style={{ width: WIDTH }}>
      <div className="flex flex-row items-start">
        <img src="/fist.png" alt="" className="fist" style={{ width: ICON, height: ICON, marginRight: GAP }} />
        <div style={{ width: COLUMN }}>
          <Time hour={sample.hour} minute={sample.minute} width={COLUMN} />
          <div style={{ marginTop: 4 }}><Bar kind="health" value={100} width={COLUMN} height={BAR_H} /></div>
          <div style={{ marginTop: 8 }}><Bar kind="armor" value={100} width={COLUMN} height={BAR_H} /></div>
        </div>
      </div>
      <div style={{ marginTop: 4 }}>
        <Outlined size={58} width={WIDTH} height={58} baseline={51} fill="#d9dbd8" anchor="end" stretch={1.18}>
          {Math.round(sample.speedKph * k)}
          <tspan style={{ fontSize: 28 }} dx="4">{mph ? "MPH" : "KM/H"}</tspan>
          <tspan style={{ fill: "#6d8c00" }} dx="18">{(sample.distanceKm * k).toFixed(2)}</tspan>
          <tspan style={{ fontSize: 28, fill: "#6d8c00" }} dx="4">{mph ? "MI" : "KM"}</tspan>
        </Outlined>
      </div>
      <div className="flex justify-end" style={{ marginTop: 6 }}><Stars active={sample.wanted ?? 6} /></div>
    </div>
  );
};

export default Hud;
