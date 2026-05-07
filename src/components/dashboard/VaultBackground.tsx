import { useMemo } from "react";

/**
 * Foreground decoration over the global body background image.
 * Soft rising particles + a slow vertical scanline (vault scan).
 */
const PARTICLE_COUNT = 14;

interface Particle {
  left: number;
  size: number;
  duration: number;
  delay: number;
  hue: "blue" | "silver";
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    left: Math.random() * 100,
    size: 2 + Math.random() * 2,
    duration: 22 + Math.random() * 18,
    delay: Math.random() * -30,
    hue: Math.random() > 0.55 ? "silver" : "blue",
  }));
}

export function VaultBackground() {
  const particles = useMemo(makeParticles, []);
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Slow scanline / vault scan */}
      <div
        className="anim-vault-scan absolute inset-x-0 h-[120%]"
        style={{
          top: "-10%",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(58,166,255,0.06) 50%, transparent 100%)",
          mixBlendMode: "screen",
        }}
      />
      {particles.map((p, i) => (
        <span
          key={i}
          className="anim-particle absolute block rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: "-10vh",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.hue === "blue" ? "#3aa6ff" : "#cfd6e4",
            boxShadow: `0 0 ${p.size * 2}px ${p.hue === "blue" ? "#3aa6ff" : "#cfd6e4"}`,
            opacity: 0.32,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Backwards-compat alias so `Index.tsx` import path is invariant. */
export const KriptexBackground = VaultBackground;
