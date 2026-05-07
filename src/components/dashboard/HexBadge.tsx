import { cn } from "@/lib/utils";

interface HexBadgeProps {
  rank: 1 | 2 | 3 | number;
  size?: number;
  className?: string;
}

/**
 * Vault-styled rank badge (banknote-seal feel) — circle with engraved
 * inner ring + numeral. Top 3 ranks use the brand silver/blue/deep-blue
 * gradient; everything else falls back to a steel default.
 */
const PALETTE: Record<
  number,
  { fill: string; stroke: string; glow: string; text: string; ring: string }
> = {
  1: {
    fill: "#0a5ec2",
    stroke: "#e7ecf5",
    glow: "#3aa6ff",
    text: "#03060d",
    ring: "#cfd6e4",
  },
  2: {
    fill: "#141d2f",
    stroke: "#cfd6e4",
    glow: "#cfd6e4",
    text: "#e7ecf5",
    ring: "#cfd6e4",
  },
  3: {
    fill: "#070b16",
    stroke: "#3aa6ff",
    glow: "#3aa6ff",
    text: "#cfd6e4",
    ring: "#3aa6ff",
  },
};

const DEFAULT = {
  fill: "#0c121f",
  stroke: "#3aa6ff",
  glow: "#3aa6ff",
  text: "#cfd6e4",
  ring: "#3aa6ff",
};

export function HexBadge({ rank, size = 48, className }: HexBadgeProps) {
  const p = PALETTE[rank] ?? DEFAULT;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn(className)}
      style={{
        filter: `drop-shadow(0 0 6px ${p.glow}aa) drop-shadow(0 0 14px ${p.glow}66)`,
      }}
      aria-hidden
    >
      {/* Outer banknote seal */}
      <circle cx="50" cy="50" r="46" fill={p.fill} stroke={p.stroke} strokeWidth="2.5" />
      {/* Inner engraved ring */}
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke={p.ring}
        strokeOpacity="0.45"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      {/* Numeral */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontFamily="Cinzel, Playfair Display, serif"
        fontSize="36"
        fontWeight="900"
        fill={p.text}
      >
        {rank}
      </text>
    </svg>
  );
}
