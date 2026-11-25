import Outlined from "./Outlined";

export type TimeProps = {
  hour: number;
  minute: number;
  width: number;
};

// The clock: Pricedown, pale grey fill (#d9dbd8 in the reference) with a heavy black outline.
const Time = ({ hour, minute, width }: TimeProps) => (
  <Outlined size={74} width={width} height={64} baseline={58} fill="#d9dbd8" outline={5} stretch={1.32}>
    {hour.toString().padStart(2, "0")}:{minute.toString().padStart(2, "0")}
  </Outlined>
);

export default Time;
