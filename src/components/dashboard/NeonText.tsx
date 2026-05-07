import { cn } from "@/lib/utils";

interface NeonTextProps {
  children: React.ReactNode;
  color?: "blue" | "silver" | "danger" | "success" | "orange" | "cyan";
  className?: string;
}

const COLOR_MAP = {
  blue: "#3aa6ff",
  silver: "#cfd6e4",
  danger: "#ff4d6a",
  success: "#1bbf8a",
  // Legacy aliases — map to vault palette so old className references still render.
  orange: "#6cc1ff",
  cyan: "#5eeaff",
} as const;

export function NeonText({
  children,
  color = "blue",
  className,
}: NeonTextProps) {
  const c = COLOR_MAP[color];
  return (
    <span
      className={cn("font-display", className)}
      style={{
        color: c,
        textShadow: `0 0 6px ${c}, 0 0 18px ${c}cc, 0 0 36px ${c}99, 0 0 64px ${c}66`,
      }}
    >
      {children}
    </span>
  );
}
