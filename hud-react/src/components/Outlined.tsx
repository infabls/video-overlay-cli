import React from "react";

// Pricedown text with a solid black outline drawn behind the fill (as in the game HUD).
// Rendered as SVG so the outline is one clean stroke instead of stacked text-shadows.
// The game draws its HUD font stretched horizontally: `stretch` scales x only.
export type OutlinedProps = {
  children: React.ReactNode;
  size: number; // font size, px
  width: number;
  height: number;
  fill: string;
  outline?: number; // outline thickness outside the glyph, px
  anchor?: "start" | "end";
  baseline?: number; // y of the baseline, px
  stretch?: number;
};

const Outlined = ({ children, size, width, height, fill, outline = 5, anchor = "start", baseline, stretch = 1 }: OutlinedProps) => {
  const x = (anchor === "end" ? width - outline : outline) / stretch;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible" className="block">
      <text
        x={x}
        y={baseline ?? height - outline}
        textAnchor={anchor}
        transform={stretch !== 1 ? `scale(${stretch} 1)` : undefined}
        className="gta-text"
        style={{ fontSize: size, fill, strokeWidth: (outline * 2) / Math.sqrt(stretch) }}
      >
        {children}
      </text>
    </svg>
  );
};

export default Outlined;
