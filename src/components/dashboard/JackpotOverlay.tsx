import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { JackpotEvent } from "@/types";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useJackpotSfx } from "@/hooks/useJackpotSfx";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";
import {
  CANNON_ARM_MS,
  CANNON_FIRE_MS,
  CANNON_FLASH_MS,
  JACKPOT_AUDIO_FADE_MS,
  JACKPOT_DURATION_MS,
} from "@/config/constants";

interface JackpotOverlayProps {
  event: JackpotEvent | null;
  onComplete: () => void;
  /** Total animation duration in ms. Falls back to JACKPOT_DURATION_MS. */
  durationMs?: number;
}

/**
 * Money-gun choreography (5 phases):
 *
 *   1. flash    — blue radial flash + intense camera shake
 *   2. arm      — gun rises from off-screen with anticipation bob; the target
 *                 (name + photo + counter) materializes at the upper third
 *   3. fire     — gun fires a continuous stream of bills with parabolic flight,
 *                 light trails, shockwave at muzzle, sparks, continuous rumble;
 *                 counter ramps up with pulses synced to bill waves
 *   4. reveal   — bills disperse, counter punch animates, confetti drifts down,
 *                 camera relaxes
 *   5. curtain  — vault doors close, fade out
 */
type Phase = "flash" | "arm" | "fire" | "reveal" | "curtain" | "done";

/** Heuristic for low-power devices: halves bill count + skips secondary effects. */
function useReducedFx() {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch {
      /* ignore */
    }
    const cores = (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency;
    if (typeof cores === "number" && cores <= 4) return true;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (typeof mem === "number" && mem <= 4) return true;
    return false;
  }, []);
}

interface BillSpec {
  id: number;
  /** Initial firing angle from vertical (radians). Negative = leans left. */
  angle: number;
  /** Max vertical rise in vh. */
  reach: number;
  /** Final lateral offset relative to muzzle, in vw. */
  scatterX: number;
  /** Slight downward drift after apex (gravity), in vh. */
  gravityFall: number;
  spin: number;
  rotateStart: number;
  size: number;
  delay: number;
  duration: number;
  hue: "blue" | "silver" | "gold-vip";
  isVip: boolean;
}

/**
 * Generate a stream of bill specs with full parabolic flight.
 *
 * Each bill follows: muzzle → ascending arc → apex → falling arc → exit screen
 * (most bills fall past the bottom of the viewport because gravityFall is high
 * enough to overshoot the original height). Combined with the wide cone, this
 * makes the gun look like a money fountain that sprays the whole screen.
 *
 * `count` controls density (75 normal, 30 reduced-fx).
 * `streamMs` is the firing window — emission delays spread evenly across it
 * but front-loaded so the first wave is impressive.
 */
function makeBills(count: number, streamMs: number): BillSpec[] {
  const streamSec = streamMs / 1000;
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(1, count - 1);
    // Wide cone (~±35° from vertical): bills spray to upper corners and middle
    // of the screen instead of stacking on a single column. Some shots near
    // ±35° will exit the side of the viewport entirely.
    const spreadRad = 0.62 * (0.45 + Math.random() * 0.95);
    const angle = (Math.random() - 0.5) * 2 * spreadRad;
    const isVip = i % 12 === 6;
    return {
      id: i,
      angle,
      // 50–80vh of vertical rise. Combined with a strong gravity fall below,
      // most bills end up well past the bottom of the screen — true fountain.
      reach: 50 + Math.random() * 30,
      scatterX: (Math.random() - 0.5) * 28,
      // Heavy gravity: bills fall 70–115vh after apex. With reach ≤ 80vh,
      // ALL bills end below their start point → exit through the bottom.
      gravityFall: 70 + Math.random() * 45,
      spin: (Math.random() - 0.5) * 540,
      rotateStart: Math.random() * 360,
      size: isVip ? 100 + Math.random() * 30 : 64 + Math.random() * 38,
      delay:
        Math.pow(t, 1.4) * (streamSec - 0.2) + (Math.random() - 0.5) * 0.06,
      // Longer flight duration so bills are visible for the full arc.
      duration: 2.0 + Math.random() * 1.2,
      hue: isVip ? "gold-vip" : Math.random() > 0.65 ? "silver" : "blue",
      isVip,
    };
  });
}

interface RainDrop {
  id: number;
  /** Horizontal position 0–100% (left). */
  left: number;
  /** Final horizontal drift in vw. */
  dx: number;
  rotateStart: number;   // deg
  spin: number;          // total deg over fall
  size: number;          // px width
  delay: number;         // s
  duration: number;      // s
  hue: "blue" | "silver" | "gold-vip";
  isVip: boolean;
}

/**
 * Generate ambient money rain — bills falling from above the viewport,
 * staggered across the entire screen width. Pure CSS keyframes (cheap),
 * runs alongside the gun stream.
 */
function makeRain(count: number): RainDrop[] {
  return Array.from({ length: count }, (_, i) => {
    const isVip = i % 14 === 9;
    return {
      id: i,
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 18,
      rotateStart: Math.random() * 360,
      spin: 360 + Math.random() * 540,
      size: isVip ? 90 + Math.random() * 30 : 56 + Math.random() * 36,
      // Staggered start — first wave hits screen ~0.5s after fire begins,
      // last wave starts ~2.5s after fire begins so the rain continues into
      // the reveal phase.
      delay: 0.4 + Math.random() * 2.6,
      duration: 3.2 + Math.random() * 2.2,
      hue: isVip ? "gold-vip" : Math.random() > 0.6 ? "silver" : "blue",
      isVip,
    };
  });
}

/**
 * Counter that ramps from 0 → value with cubic ease-out.
 *
 * IMPORTANT: `onComplete` lives in a ref so a new function reference from the
 * parent does NOT restart the animation. Without this, every parent re-render
 * (phase change, bills map, etc.) cancels the rAF and starts over from 0,
 * which manifests as numbers jumping up and down randomly during the count.
 */
function CountUp({
  value,
  durationMs,
  onComplete,
}: {
  value: number;
  durationMs: number;
  onComplete?: () => void;
}) {
  const [display, setDisplay] = useState(0);
  const onCompleteRef = useRef(onComplete);
  // Always read the latest callback without re-running the effect.
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const k = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(value * eased));
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onCompleteRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Intentionally NOT depending on onComplete — it changes every render and
    // would restart the count. The ref pattern above keeps it always-fresh.
  }, [value, durationMs]);
  return <span>+{formatCurrency(display)}</span>;
}

/**
 * Banknote inline SVG. Renders one variant — or a "VIP" variant with gold/silver
 * accents that stands out in the stream. Cheap vector, scales perfectly.
 */
function Bill({ size, vip }: { size: number; vip?: boolean }) {
  const accent1 = vip ? "#f5d77a" : "#6cc1ff";
  const accent2 = vip ? "#a47326" : "#0a5ec2";
  const numText = vip ? "1000" : "100";
  return (
    <svg
      width={size}
      height={(size * 90) / 200}
      viewBox="0 0 200 90"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={`b-bg-${vip ? "v" : "n"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1a2e" />
          <stop offset="100%" stopColor="#03060d" />
        </linearGradient>
        <linearGradient id={`b-acc-${vip ? "v" : "n"}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={accent1} />
          <stop offset="100%" stopColor={accent2} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="198" height="88" rx="6" fill={`url(#b-bg-${vip ? "v" : "n"})`} stroke={accent1} strokeWidth="1.5" />
      <rect x="6" y="6" width="188" height="78" rx="4" fill="none" stroke="#cfd6e4" strokeOpacity="0.32" strokeDasharray="2 3" />
      <circle cx="100" cy="45" r="22" fill="none" stroke={`url(#b-acc-${vip ? "v" : "n"})`} strokeWidth="2" />
      <circle cx="100" cy="45" r="16" fill="none" stroke="#cfd6e4" strokeOpacity="0.45" />
      <text x="100" y="53" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="22" fontWeight="900" fill={`url(#b-acc-${vip ? "v" : "n"})`}>
        $
      </text>
      <text x="14" y="22" fontFamily="Cinzel, serif" fontSize={vip ? 12 : 14} fontWeight="800" fill="#cfd6e4" fillOpacity="0.85">
        {numText}
      </text>
      <text x="186" y="80" textAnchor="end" fontFamily="Cinzel, serif" fontSize={vip ? 12 : 14} fontWeight="800" fill="#cfd6e4" fillOpacity="0.85">
        {numText}
      </text>
    </svg>
  );
}

/**
 * Money pistol pointing straight up. While `firing`, the muzzle flares
 * continuously with a fast pulse and the engraved $ on the receiver glows.
 */
function MoneyGun({ firing }: { firing: boolean }) {
  return (
    <svg
      viewBox="0 0 240 400"
      width="100%"
      height="100%"
      style={{
        filter:
          "drop-shadow(0 0 24px rgba(58,166,255,0.55)) drop-shadow(0 8px 16px rgba(0,0,0,0.6))",
      }}
    >
      <defs>
        <linearGradient id="g-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2840" />
          <stop offset="100%" stopColor="#03060d" />
        </linearGradient>
        <linearGradient id="g-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7ecf5" />
          <stop offset="100%" stopColor="#6c7689" />
        </linearGradient>
        <linearGradient id="g-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6cc1ff" />
          <stop offset="100%" stopColor="#0a5ec2" />
        </linearGradient>
        <radialGradient id="g-muzzle" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#6cc1ff" />
          <stop offset="70%" stopColor="#0a5ec2" />
          <stop offset="100%" stopColor="#03060d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grip */}
      <path d="M 70 400 L 175 400 L 165 245 L 80 245 Z" fill="url(#g-body)" stroke="url(#g-rim)" strokeWidth="2.5" />
      <text x="123" y="345" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="56" fontWeight="900" fill="url(#g-blue)" opacity="0.85">
        $
      </text>
      <g stroke="#3aa6ff" strokeOpacity="0.35" strokeWidth="1.5">
        <line x1="80" y1="262" x2="166" y2="262" />
        <line x1="80" y1="272" x2="166" y2="272" />
        <line x1="78" y1="380" x2="170" y2="380" />
        <line x1="78" y1="390" x2="170" y2="390" />
      </g>

      {/* Trigger guard + trigger */}
      <path d="M 80 245 Q 60 245 60 220 Q 60 200 80 200 L 92 200" fill="none" stroke="url(#g-rim)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="74" y1="218" x2="84" y2="232" stroke="#cfd6e4" strokeWidth="3" strokeLinecap="round" />

      {/* Receiver */}
      <rect x="60" y="150" width="120" height="100" rx="10" fill="url(#g-body)" stroke="url(#g-rim)" strokeWidth="2.5" />
      <rect x="68" y="158" width="104" height="84" rx="6" fill="none" stroke="#cfd6e4" strokeOpacity="0.25" strokeDasharray="2 3" />
      <text x="120" y="210" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="38" fontWeight="900" fill="url(#g-blue)" opacity={firing ? 1 : 0.78}>
        $
      </text>

      {/* Sights */}
      <rect x="100" y="138" width="40" height="14" rx="2" fill="url(#g-body)" stroke="url(#g-rim)" strokeWidth="1.5" />

      {/* Barrel */}
      <rect x="98" y="40" width="44" height="100" rx="4" fill="url(#g-body)" stroke="url(#g-rim)" strokeWidth="2.5" />
      <line x1="120" y1="46" x2="120" y2="134" stroke="#cfd6e4" strokeOpacity="0.35" strokeWidth="2" />

      {/* Muzzle ring */}
      <ellipse cx="120" cy="40" rx="28" ry="10" fill="url(#g-muzzle)" />
      <ellipse cx="120" cy="40" rx="22" ry="7" fill="#03060d" />
      {firing && (
        <>
          {/* Inner muzzle glow — fast pulse */}
          <ellipse cx="120" cy="40" rx="18" ry="5" fill="#6cc1ff">
            <animate attributeName="opacity" values="0.4;1;0.5;1;0.4" dur="0.32s" repeatCount="indefinite" />
            <animate attributeName="rx" values="14;22;14;22;14" dur="0.32s" repeatCount="indefinite" />
          </ellipse>
          {/* Outer muzzle flash */}
          <ellipse cx="120" cy="20" rx="44" ry="22" fill="url(#g-muzzle)" opacity="0.7">
            <animate attributeName="opacity" values="0;0.95;0;0.8;0" dur="0.28s" repeatCount="indefinite" />
            <animate attributeName="ry" values="12;30;14;28;12" dur="0.28s" repeatCount="indefinite" />
          </ellipse>
          {/* Long flame plume */}
          <ellipse cx="120" cy="0" rx="22" ry="35" fill="url(#g-muzzle)" opacity="0.45">
            <animate attributeName="opacity" values="0;0.7;0.2;0.6;0" dur="0.28s" repeatCount="indefinite" />
            <animate attributeName="ry" values="20;48;25;42;20" dur="0.28s" repeatCount="indefinite" />
          </ellipse>
        </>
      )}
    </svg>
  );
}

/**
 * Tiny sparks emerging from the muzzle continuously during fire.
 * Pure CSS keyframes — each spark is a 1-shot animation.
 */
function MuzzleSparks({ count = 14 }: { count?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        dx: (Math.random() - 0.5) * 60,
        size: 3 + Math.random() * 3,
        delay: Math.random() * 1.4,
        duration: 0.4 + Math.random() * 0.4,
      })),
    [count],
  );
  return (
    <div
      className="pointer-events-none absolute left-1/2"
      style={{ bottom: "30%", transform: "translateX(-50%)" }}
      aria-hidden
    >
      {sparks.map((s) => (
        <span
          key={s.id}
          className="anim-spark-rise absolute rounded-full"
          style={
            {
              left: 0,
              bottom: 0,
              width: s.size,
              height: s.size,
              background: "linear-gradient(180deg, #ffffff 0%, #6cc1ff 100%)",
              boxShadow: "0 0 6px #6cc1ff, 0 0 12px rgba(58,166,255,0.6)",
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              ["--dx" as string]: `${s.dx}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Concentric blue shockwave at the muzzle every ~280ms. Visible only during
 * fire phase. Cheap (4 DOM nodes, transform-only animation).
 */
function ShockwaveRings() {
  const rings = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: i,
        delay: i * 0.28,
      })),
    [],
  );
  return (
    <div
      className="pointer-events-none absolute left-1/2"
      style={{ bottom: "30%", transform: "translateX(-50%)" }}
      aria-hidden
    >
      {rings.map((r) => (
        <span
          key={r.id}
          className="anim-shockwave absolute rounded-full"
          style={{
            left: 0,
            bottom: 0,
            width: 80,
            height: 80,
            border: "2px solid rgba(108,193,255,0.85)",
            boxShadow: "0 0 16px rgba(58,166,255,0.6)",
            animationDelay: `${r.delay}s`,
            animationIterationCount: "infinite",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Ambient money rain — bills falling from above the viewport. Pure CSS
 * animation per drop (no Framer Motion overhead), only `transform` and
 * `opacity` so the GPU does the work.
 */
function MoneyRain({ drops }: { drops: RainDrop[] }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {drops.map((d) => (
        <div
          key={d.id}
          className="anim-bill-rain absolute"
          style={
            {
              left: `${d.left}%`,
              top: 0,
              width: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
              filter:
                d.hue === "gold-vip"
                  ? "drop-shadow(0 0 10px rgba(245,215,122,0.7))"
                  : d.hue === "silver"
                    ? "drop-shadow(0 0 6px rgba(207,214,228,0.55))"
                    : "drop-shadow(0 0 6px rgba(58,166,255,0.55))",
              ["--dx" as string]: `${d.dx}vw`,
              ["--rot" as string]: `${d.rotateStart}deg`,
              ["--spin" as string]: `${d.spin}deg`,
            } as React.CSSProperties
          }
        >
          <Bill size={d.size} vip={d.isVip} />
        </div>
      ))}
    </div>
  );
}

/**
 * Confetti drifting down at the reveal phase. Subtle (14 pieces), short-lived.
 */
function Confetti({ enabled }: { enabled: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 6 + Math.random() * 4,
        dx: (Math.random() - 0.5) * 20,
        delay: Math.random() * 1.2,
        duration: 2.6 + Math.random() * 1.5,
        hue: Math.random() > 0.5 ? "#cfd6e4" : "#6cc1ff",
      })),
    [],
  );
  if (!enabled) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="anim-confetti absolute rounded-sm"
          style={
            {
              left: `${p.left}%`,
              top: "-4%",
              width: p.size,
              height: p.size * 1.6,
              background: p.hue,
              boxShadow: `0 0 6px ${p.hue}`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--dx" as string]: `${p.dx}vw`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function JackpotOverlay({
  event,
  onComplete,
  durationMs,
}: JackpotOverlayProps) {
  const { play, stop } = useAudioPlayer();
  const sfx = useJackpotSfx();
  const reducedFx = useReducedFx();
  const totalMs = durationMs ?? JACKPOT_DURATION_MS;
  const [phase, setPhase] = useState<Phase>("flash");
  const [shaking, setShaking] = useState(false);
  /** Punch animation when the counter reaches its final value. */
  const [counterPunched, setCounterPunched] = useState(false);
  const counterPunchTimer = useRef<number | null>(null);

  // Bills computed once per event so they stay stable across renders.
  // Gun stream (Framer Motion, parabolic) + rain drops (CSS, falling).
  const bills = useMemo(
    () => makeBills(reducedFx ? 30 : 75, CANNON_FIRE_MS),
    [event?.triggeredAt, reducedFx],
  );
  const rain = useMemo(
    () => makeRain(reducedFx ? 50 : 110),
    [event?.triggeredAt, reducedFx],
  );

  useEffect(() => {
    if (!event) return;
    logger.info("money gun firing", {
      agent: event.agent.name,
      amount: event.amount,
      hasSong: !!event.agent.songUrl,
      totalMs,
      reducedFx,
    });

    setPhase("flash");
    setShaking(true);
    setCounterPunched(false);

    sfx.mechanical();
    const sfxBurst = window.setTimeout(
      () => sfx.cashBurst(),
      CANNON_FLASH_MS + CANNON_ARM_MS,
    );
    const sfxStinger = window.setTimeout(
      () => sfx.winStinger(),
      CANNON_FLASH_MS + CANNON_ARM_MS + Math.max(0, CANNON_FIRE_MS - 250),
    );

    const tShake = window.setTimeout(() => setShaking(false), 380);
    const tArm = window.setTimeout(() => setPhase("arm"), CANNON_FLASH_MS);
    const tFire = window.setTimeout(
      () => setPhase("fire"),
      CANNON_FLASH_MS + CANNON_ARM_MS,
    );
    const tReveal = window.setTimeout(
      () => setPhase("reveal"),
      CANNON_FLASH_MS + CANNON_ARM_MS + CANNON_FIRE_MS,
    );
    const tCurtain = window.setTimeout(
      () => setPhase("curtain"),
      Math.max(0, totalMs - 500),
    );
    const tDone = window.setTimeout(() => {
      setPhase("done");
      onComplete();
    }, totalMs);

    const cleanup = () => {
      window.clearTimeout(tShake);
      window.clearTimeout(tArm);
      window.clearTimeout(tFire);
      window.clearTimeout(tReveal);
      window.clearTimeout(tCurtain);
      window.clearTimeout(tDone);
      window.clearTimeout(sfxBurst);
      window.clearTimeout(sfxStinger);
      if (counterPunchTimer.current) {
        window.clearTimeout(counterPunchTimer.current);
        counterPunchTimer.current = null;
      }
      sfx.stop();
      stop();
    };

    if (event.agent.songUrl) {
      const audioStart = window.setTimeout(() => {
        play({
          url: event.agent.songUrl as string,
          startSeconds: event.agent.songStartSeconds,
          fadeOutMs: JACKPOT_AUDIO_FADE_MS,
          totalDurationMs: totalMs - CANNON_FLASH_MS,
        });
      }, CANNON_FLASH_MS);
      return () => {
        window.clearTimeout(audioStart);
        cleanup();
      };
    }

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.triggeredAt]);

  if (!event) return null;

  const counterDuration = CANNON_FIRE_MS;
  const billsVisible = phase === "fire" || phase === "reveal" || phase === "curtain";
  const counterActive = phase === "fire" || phase === "reveal" || phase === "curtain";
  const targetVisible = phase !== "flash";
  const isFiring = phase === "fire";
  const showConfetti = phase === "reveal" || phase === "curtain";

  return (
    <AnimatePresence>
      {event && phase !== "done" && (
        <motion.div
          key={event.triggeredAt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Subtle breathing zoom: tightens during fire, relaxes at reveal.
          // Sells the drama without being nauseating.
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(20, 29, 47, 0.94) 0%, rgba(3, 6, 13, 0.98) 75%)",
          }}
          className="fixed inset-0 z-50 flex items-start justify-center"
        >
          {/* Camera-shake / rumble wrapper — only this transforms, so the
              backdrop and frame stay fixed. */}
          <motion.div
            className={`absolute inset-0 ${shaking ? "anim-camera-shake" : ""} ${isFiring && !reducedFx ? "anim-camera-rumble" : ""}`}
            animate={{
              scale: phase === "fire" ? 1.015 : phase === "reveal" ? 1.0 : 1,
            }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ── Phase 1: blue radial flash ─────────────────────────── */}
            <AnimatePresence>
              {phase === "flash" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: CANNON_FLASH_MS / 1000,
                    times: [0, 0.25, 1],
                  }}
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse at center 75%, #ffffff 0%, #6cc1ff 30%, #3aa6ff 55%, transparent 80%)",
                    mixBlendMode: "screen",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Vignette that intensifies during fire */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 35%, rgba(3,6,13,0.55) 80%, rgba(3,6,13,0.85) 100%)",
              }}
              animate={{
                opacity: phase === "fire" ? 1 : phase === "flash" ? 0 : 0.5,
              }}
              transition={{ duration: 0.5 }}
              aria-hidden
            />

            {/* Banknote-style ornamental frame */}
            <div
              className="pointer-events-none absolute inset-6 rounded-xl border border-vault-blue/30"
              aria-hidden
              style={{ boxShadow: "inset 0 0 80px rgba(58,166,255,0.18)" }}
            >
              <div
                className="absolute inset-3 rounded-lg border border-dashed"
                style={{ borderColor: "rgba(207,214,228,0.18)" }}
              />
            </div>

            {/* Hallmark at very top */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
              <p className="font-sans text-[10px] uppercase tracking-[0.55em] text-vault-blue/70">
                vault dispatch
              </p>
            </div>

            {/* ── TARGET: name + photo + counter (upper third) ─────── */}
            {targetVisible && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: -32 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 240,
                  damping: 18,
                  mass: 0.9,
                }}
                className="relative z-20 mt-[8vh] flex flex-col items-center gap-4 px-4 text-center"
              >
                <motion.h2
                  className="font-display text-4xl uppercase tracking-[0.18em] sm:text-5xl"
                  style={{
                    color: "#6cc1ff",
                    textShadow:
                      "0 0 8px #3aa6ff, 0 0 24px rgba(10,94,194,0.7), 0 0 64px rgba(10,94,194,0.4)",
                  }}
                  // Title bobs slightly during fire (sells the impact).
                  animate={
                    isFiring ? { y: [0, -3, 0, 2, 0] } : { y: 0 }
                  }
                  transition={{ duration: 0.4, repeat: isFiring ? Infinity : 0 }}
                >
                  CASH OUT
                </motion.h2>

                <AgentSeal
                  photoUrl={event.agent.photoUrl}
                  name={event.agent.name}
                  glowing={isFiring || phase === "reveal"}
                />

                <p
                  className="font-display text-2xl uppercase tracking-[0.18em] sm:text-3xl"
                  style={{
                    color: "#e7ecf5",
                    textShadow:
                      "0 0 6px rgba(207,214,228,0.4), 0 0 18px rgba(58,166,255,0.4)",
                  }}
                >
                  {event.agent.name}
                </p>

                {/* Counter card — ramps during fire, punches at end. */}
                <motion.div
                  className="rounded-lg border-2 border-vault-blue bg-vault-ink/85 px-8 py-3 font-digital text-5xl shadow-vault-glow sm:text-6xl"
                  style={{
                    color: "#6cc1ff",
                    textShadow: "0 0 10px #3aa6ff",
                  }}
                  animate={
                    counterPunched
                      ? {
                          scale: [1, 1.18, 1.04, 1.1, 1],
                          boxShadow: [
                            "0 0 24px rgba(58,166,255,0.4)",
                            "0 0 64px rgba(108,193,255,0.95), 0 0 120px rgba(27,191,138,0.6)",
                            "0 0 48px rgba(108,193,255,0.7)",
                            "0 0 56px rgba(108,193,255,0.85)",
                            "0 0 28px rgba(58,166,255,0.5)",
                          ],
                        }
                      : isFiring
                        ? { scale: [1, 1.025, 1] }
                        : { scale: 1 }
                  }
                  transition={
                    counterPunched
                      ? { duration: 0.7, times: [0, 0.2, 0.45, 0.7, 1] }
                      : { duration: 0.35, repeat: isFiring ? Infinity : 0, ease: "easeInOut" }
                  }
                >
                  {counterActive ? (
                    <CountUp
                      value={event.amount}
                      durationMs={counterDuration}
                      onComplete={() => {
                        setCounterPunched(true);
                        if (counterPunchTimer.current) {
                          window.clearTimeout(counterPunchTimer.current);
                        }
                        counterPunchTimer.current = window.setTimeout(
                          () => setCounterPunched(false),
                          800,
                        );
                      }}
                    />
                  ) : (
                    <span>+{formatCurrency(0)}</span>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* ── GUN STREAM — full parabolic fountain ──────────────── */}
            {billsVisible && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                {bills.map((b) => {
                  // Full parabola: muzzle → mid-rise → apex → mid-fall →
                  // exit through bottom of screen. Bills with wide angle exit
                  // through the sides instead. The stream sprays everywhere.
                  const dxApex = Math.sin(b.angle) * b.reach * 0.7;
                  // Final horizontal: scatter + accumulated angle drift.
                  const dxFinal = b.scatterX + Math.sin(b.angle) * 22;
                  const dyApex = -b.reach;
                  // Bills end well past the bottom of the viewport (positive y)
                  // because reach is at most 80vh and gravityFall is 70-115vh.
                  const dyFinal = -b.reach + b.gravityFall;
                  return (
                    <motion.div
                      key={b.id}
                      className="absolute will-change-transform"
                      style={{
                        left: "50%",
                        bottom: "20%",
                        width: b.size,
                        transform: `translateX(-50%)`,
                        filter:
                          b.hue === "silver"
                            ? "drop-shadow(0 0 8px rgba(207,214,228,0.6))"
                            : b.hue === "gold-vip"
                              ? "drop-shadow(0 0 12px rgba(245,215,122,0.85))"
                              : "drop-shadow(0 0 8px rgba(58,166,255,0.65))",
                      }}
                      initial={{
                        x: 0,
                        y: 0,
                        opacity: 0,
                        rotate: b.rotateStart,
                        scale: 0.4,
                      }}
                      animate={{
                        // Five-keyframe parabolic path: ejection → mid-rise →
                        // apex → mid-fall → exit screen.
                        x: [0, dxApex * 0.5, dxApex, dxApex * 1.05, dxFinal],
                        y: [
                          0,
                          dyApex * 0.5,
                          dyApex,                  // peak
                          (dyApex + dyFinal) / 2,  // halfway down
                          dyFinal,                 // exit (positive y = below viewport)
                        ],
                        opacity: [0, 1, 1, 0.95, 0],
                        rotate: b.rotateStart + b.spin,
                        scale: [0.4, 1, 0.98, 0.92, 0.85],
                      }}
                      transition={{
                        duration: b.duration,
                        delay: b.delay,
                        // 0% → 25% → 50% → 80% → 100% — apex at midpoint, more
                        // time spent on the descent so it feels weighty.
                        times: [0, 0.25, 0.5, 0.8, 1],
                        ease: "linear",
                      }}
                    >
                      <Bill size={b.size} vip={b.isVip} />
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── MONEY RAIN — fills the entire viewport with bills ─── */}
            {billsVisible && <MoneyRain drops={rain} />}

            {/* ── MONEY GUN ─────────────────────────────────────────── */}
            <motion.div
              className="absolute left-1/2"
              style={{
                width: "min(220px, 32vw)",
                height: "min(360px, 48vh)",
                bottom: "-2vh",
              }}
              initial={{ x: "-50%", y: "70%", opacity: 0, rotate: 4 }}
              animate={{
                x: "-50%",
                y:
                  phase === "arm"
                    ? ["70%", "0%", "-3%", "0%"]      // Anticipation bob
                    : phase === "fire"
                      ? [0, 6, 0, 5, 0, 4, 0]         // Continuous recoil
                      : phase === "reveal"
                        ? "0%"
                        : "70%",
                opacity: phase === "flash" ? 0.4 : 1,
                rotate:
                  phase === "fire"
                    ? [0, 1.5, -1, 1, 0]
                    : phase === "arm"
                      ? [4, -1, 1, 0]
                      : 0,
              }}
              transition={{
                duration:
                  phase === "fire"
                    ? 0.32
                    : phase === "arm"
                      ? CANNON_ARM_MS / 1000
                      : 0.6,
                repeat: phase === "fire" ? Infinity : 0,
                ease: phase === "fire" ? "easeInOut" : [0.34, 1.56, 0.64, 1],
                type: phase === "arm" ? "tween" : undefined,
              }}
            >
              <MoneyGun firing={phase === "fire"} />
            </motion.div>

            {/* Muzzle effects only during fire */}
            {isFiring && !reducedFx && (
              <>
                <ShockwaveRings />
                <MuzzleSparks count={16} />
                {/* Heat haze overlay above muzzle */}
                <div
                  className="anim-muzzle-haze pointer-events-none absolute left-1/2"
                  style={{
                    bottom: "32%",
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, rgba(108,193,255,0.5) 0%, transparent 70%)",
                    transform: "translateX(-50%)",
                  }}
                  aria-hidden
                />
              </>
            )}

            {/* Tracer beam — pulsing column from muzzle to name */}
            {isFiring && !reducedFx && (
              <motion.div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                style={{
                  bottom: "26%",
                  width: 6,
                  height: "55vh",
                  background:
                    "linear-gradient(0deg, rgba(108,193,255,0.7) 0%, rgba(58,166,255,0) 100%)",
                  filter: "blur(3px)",
                  transformOrigin: "bottom",
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{
                  scaleY: [0, 1, 0.85, 1, 0.9, 1, 0.7],
                  opacity: [0, 0.95, 0.55, 0.85, 0.6, 0.8, 0],
                }}
                transition={{ duration: CANNON_FIRE_MS / 1000, ease: "easeOut" }}
              />
            )}

            {/* Confetti at reveal */}
            <Confetti enabled={showConfetti && !reducedFx} />

            {/* ── Curtain — vault doors close ──────────────────────── */}
            {phase === "curtain" && (
              <>
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  transition={{ duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
                  className="absolute inset-y-0 left-0 w-1/2"
                  style={{
                    background:
                      "linear-gradient(90deg, #03060d 0%, #070b16 80%, transparent 100%)",
                    boxShadow: "inset -20px 0 40px rgba(58,166,255,0.15)",
                  }}
                />
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  transition={{ duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
                  className="absolute inset-y-0 right-0 w-1/2"
                  style={{
                    background:
                      "linear-gradient(270deg, #03060d 0%, #070b16 80%, transparent 100%)",
                    boxShadow: "inset 20px 0 40px rgba(58,166,255,0.15)",
                  }}
                />
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentSeal({
  photoUrl,
  name,
  glowing,
}: {
  photoUrl: string | null;
  name: string;
  glowing?: boolean;
}) {
  return (
    <motion.div
      className="relative h-32 w-32 sm:h-40 sm:w-40"
      animate={
        glowing
          ? {
              filter: [
                "drop-shadow(0 0 12px rgba(58,166,255,0.6))",
                "drop-shadow(0 0 32px rgba(108,193,255,0.9))",
                "drop-shadow(0 0 18px rgba(58,166,255,0.7))",
              ],
            }
          : { filter: "drop-shadow(0 0 8px rgba(58,166,255,0.4))" }
      }
      transition={{ duration: 1.2, repeat: glowing ? Infinity : 0, ease: "easeInOut" }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(58,166,255,0.55), rgba(207,214,228,0.6), rgba(10,94,194,0.7), rgba(58,166,255,0.55))",
          padding: 5,
        }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background: "linear-gradient(180deg, #070b16 0%, #03060d 100%)",
          }}
        />
      </div>
      <motion.div
        className="absolute inset-2 rounded-full"
        style={{ border: "1px dashed rgba(207,214,228,0.45)" }}
        animate={glowing ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 18, repeat: glowing ? Infinity : 0, ease: "linear" }}
      />
      <div className="absolute inset-3 overflow-hidden rounded-full ring-2 ring-vault-blue/70">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-vault-ink">
            <span className="font-display text-5xl text-cyan-glow">
              {name.charAt(0)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
