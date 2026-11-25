import { useEffect, useState } from "react";
import Bar from "./Bar";
import Time from "./Time";

type HudSample = { hour: number; minute: number; speedKph: number; distanceKm: number };
declare global { interface Window { setHudSample?: (sample: HudSample) => void } }

const Hud = () => {
  const [sample, setSample] = useState<HudSample>({ hour: 4, minute: 55, speedKph: 0, distanceKm: 0 });
  useEffect(() => { window.setHudSample = setSample; return () => { delete window.setHudSample; }; }, []);
  return (
    <div className="hud-anchor select-none">
      <div className="flex flex-row items-start">
        <div className="mr-2 w-[100px] h-[100px] flex items-center justify-center">
          <img src="/bicycle.png" alt="Bicycle" className="w-[88px] h-[88px] object-contain brightness-0 invert" />
        </div>
        <div className="w-[240px]">
          <Time hour={sample.hour} minute={sample.minute} />
          <div className="mt-2">
            <Bar foregroundColor="bg-hud-red" backgroundColor="bg-hud-dark-red" value={100} />
            <Bar foregroundColor="bg-hud-white" backgroundColor="bg-hud-grey" value={100} />
          </div>
        </div>
      </div>
      <div className="mt-[-0.75rem] flex items-baseline gap-6">
        <div className="font-pricedown text-5xl text-white font-outline-4 whitespace-nowrap">
          {sample.speedKph.toFixed(1)}<span className="ml-2 text-xl">KM/H</span>
        </div>
        <div className="font-pricedown text-5xl text-hud-green font-outline-4 whitespace-nowrap">
          {sample.distanceKm.toFixed(2)}<span className="ml-2 text-xl">KM</span>
        </div>
      </div>
    </div>
  );
};

export default Hud;
