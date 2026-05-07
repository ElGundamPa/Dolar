import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/branding";

interface BrandMarkProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * Banknote-seal style monogram fallback. Used when no logo image is set
 * via VITE_BRAND_LOGO / branding.ts. Drop-in replacement: keeps the same
 * 100×100 viewBox so other components don't need to know about it.
 */
function MonogramSvg({ size, label }: { size: number; label: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="brand-mono-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6cc1ff" />
          <stop offset="100%" stopColor="#0a5ec2" />
        </linearGradient>
        <linearGradient id="brand-mono-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7ecf5" />
          <stop offset="100%" stopColor="#9aa3b5" />
        </linearGradient>
      </defs>
      {/* Outer disk */}
      <circle cx="50" cy="50" r="46" fill="rgba(7, 11, 22, 0.92)" stroke="url(#brand-mono-fill)" strokeWidth="2.5" />
      {/* Engraved ring */}
      <circle cx="50" cy="50" r="38" fill="none" stroke="url(#brand-mono-silver)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 3" />
      {/* Inner ring */}
      <circle cx="50" cy="50" r="30" fill="none" stroke="url(#brand-mono-fill)" strokeOpacity="0.5" strokeWidth="1" />
      <text
        x="50"
        y={label.length === 1 ? 65 : 62}
        textAnchor="middle"
        fontFamily="Cinzel, Playfair Display, serif"
        fontSize={label.length === 1 ? 46 : 30}
        fontWeight="900"
        fill="url(#brand-mono-fill)"
      >
        {label.slice(0, 3).toUpperCase()}
      </text>
    </svg>
  );
}

export function BrandMark({
  size = 96,
  showWordmark = false,
  className,
}: BrandMarkProps) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = BRAND.documentTitle;
    }
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="relative"
        style={{
          filter:
            "drop-shadow(0 0 12px rgba(58, 166, 255, 0.45)) drop-shadow(0 0 24px rgba(207, 214, 228, 0.12))",
        }}
      >
        {BRAND.logoPath ? (
          <img
            src={BRAND.logoPath}
            alt={BRAND.name}
            width={size}
            height={Math.round(size * 0.55)}
            style={{ width: size, height: "auto", objectFit: "contain" }}
            onError={(e) => {
              // If the configured logo can't load, hide it so nothing visual breaks.
              // Components above us already have a monogram fallback path via branding.ts.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <MonogramSvg size={size} label={BRAND.monogram} />
        )}
      </div>
      {showWordmark && (
        <span
          className="font-display tracking-[0.35em] text-cyan-glow"
          style={{ fontSize: Math.max(16, size * 0.16) }}
        >
          {BRAND.name.toUpperCase()}
        </span>
      )}
    </div>
  );
}
