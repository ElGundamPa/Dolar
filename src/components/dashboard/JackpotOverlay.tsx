import { useEffect, useMemo, useState } from "react";
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
  CANNON_REVEAL_MS,
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
 * Phases:
 *   1. flash    — short blue flash + camera shake (~CANNON_FLASH_MS)
 *   2. arm      — cannon mechanical "lock and load" (~CANNON_ARM_MS)
 *   3. fire     — bills firing out, particle physics, count-up
 *   4. reveal   — agent + amount stays visible
 *   5. curtain  — vault doors close, fade out
 */
type Phase = "flash" | "arm" | "fire" | "reveal" | "curtain" | "done";

/**
 * Detect a device that's likely too slow for the full effect.
 * Heuristic: tablet / phone CPUs report low hardwareConcurrency; reduced-motion
 * users opt out explicitly. Either condition halves particle count.
 */
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
  /** firing angle in radians, 0 = straight up. */
  angle: number;
  speed: number;        // initial speed, vh/s
  spin: number;         // deg/s
  rotateStart: number;  // deg
  size: number;         // px width
  delay: number;        // s — staggered firing
  duration: number;     // s — flight time
  driftX: number;       // horizontal drift component (sideways)
  hue: number;          // 0..1 hue offset (kept tiny, mostly silver/blue)
}

function makeBills(count: number): BillSpec[] {
  return Array.from({ length: count }, (_, i) => {
    // Cone aimed up — 70° spread total.
    const spread = (Math.random() - 0.5) * (Math.PI / 2.5);
    return {
      id: i,
      angle: spread,
      speed: 95 + Math.random() * 60,
      spin: (Math.random() * 720 - 360),
      rotateStart: Math.random() * 360,
      size: 78 + Math.random() * 38,
      delay: Math.random() * 0.55,
      duration: 1.6 + Math.random() * 1.2,
      driftX: (Math.random() - 0.5) * 18,
      hue: Math.random(),
    };
  });
}

function CountUp({
  value,
  durationMs = 1200,
}: {
  value: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const k = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(value * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <span>+{formatCurrency(display)}</span>;
}

/**
 * Single banknote rendered as inline SVG so we don't depend on /public/bill.svg
 * being reachable. Cheap, vector, scales perfectly.
 */
function Bill({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={(size * 90) / 200}
      viewBox="0 0 200 90"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="b-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1a2e" />
          <stop offset="100%" stopColor="#03060d" />
        </linearGradient>
        <linearGradient id="b-blue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6cc1ff" />
          <stop offset="100%" stopColor="#0a5ec2" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="198"
        height="88"
        rx="6"
        fill="url(#b-bg)"
        stroke="#3aa6ff"
        strokeWidth="1.5"
      />
      <rect
        x="6"
        y="6"
        width="188"
        height="78"
        rx="4"
        fill="none"
        stroke="#cfd6e4"
        strokeOpacity="0.32"
        strokeDasharray="2 3"
      />
      <circle cx="100" cy="45" r="22" fill="none" stroke="url(#b-blue)" strokeWidth="2" />
      <circle cx="100" cy="45" r="16" fill="none" stroke="#cfd6e4" strokeOpacity="0.45" />
      <text
        x="100"
        y="53"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontSize="22"
        fontWeight="900"
        fill="url(#b-blue)"
      >
        $
      </text>
      <text
        x="14"
        y="22"
        fontFamily="Cinzel, serif"
        fontSize="14"
        fontWeight="800"
        fill="#cfd6e4"
        fillOpacity="0.85"
      >
        100
      </text>
      <text
        x="186"
        y="80"
        textAnchor="end"
        fontFamily="Cinzel, serif"
        fontSize="14"
        fontWeight="800"
        fill="#cfd6e4"
        fillOpacity="0.85"
      >
        100
      </text>
    </svg>
  );
}

/**
 * Cannon body — a stylized vault muzzle with a glowing barrel.
 */
function Cannon({ firing }: { firing: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 320 200"
      width="100%"
      height="100%"
      style={{ filter: "drop-shadow(0 0 18px rgba(58,166,255,0.45))" }}
      animate={firing ? { y: [0, -6, 0], x: [0, -4, 0] } : { y: 0, x: 0 }}
      transition={{ duration: 0.18, repeat: firing ? 4 : 0 }}
    >
      <defs>
        <linearGradient id="c-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2840" />
          <stop offset="100%" stopColor="#03060d" />
        </linearGradient>
        <linearGradient id="c-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfd6e4" />
          <stop offset="100%" stopColor="#6c7689" />
        </linearGradient>
        <radialGradient id="c-mouth" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#6cc1ff" />
          <stop offset="60%" stopColor="#0a5ec2" />
          <stop offset="100%" stopColor="#03060d" />
        </radialGradient>
      </defs>
      {/* base / chassis */}
      <rect x="40" y="120" width="240" height="50" rx="8" fill="url(#c-body)" stroke="url(#c-rim)" strokeWidth="2" />
      {/* wheels / vault rivets */}
      {[60, 110, 160, 210, 260].map((cx) => (
        <circle key={cx} cx={cx} cy="170" r="6" fill="#1d2840" stroke="#3aa6ff" strokeWidth="1.5" />
      ))}
      {/* barrel */}
      <rect x="120" y="50" width="80" height="80" rx="8" fill="url(#c-body)" stroke="url(#c-rim)" strokeWidth="2" />
      {/* muzzle */}
      <ellipse cx="160" cy="50" rx="44" ry="14" fill="url(#c-mouth)" stroke="url(#c-rim)" strokeWidth="2" />
      <ellipse cx="160" cy="50" rx="30" ry="9" fill="#03060d" />
      {/* glowing core */}
      {firing && (
        <ellipse
          cx="160"
          cy="50"
          rx="20"
          ry="6"
          fill="#6cc1ff"
          opacity="0.9"
        >
          <animate attributeName="opacity" values="0.4;1;0.4" dur="0.4s" repeatCount="indefinite" />
        </ellipse>
      )}
      {/* engraved $ on barrel */}
      <text
        x="160"
        y="105"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontSize="34"
        fontWeight="900"
        fill="#3aa6ff"
        opacity="0.85"
      >
        $
      </text>
    </motion.svg>
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

  // Pre-compute bill specs once per event so the same particles persist
  // through the fire→reveal phases.
  const bills = useMemo(
    () => makeBills(reducedFx ? 18 : 44),
    [event?.triggeredAt, reducedFx],
  );

  useEffect(() => {
    if (!event) return;
    logger.info("money cannon firing", {
      agent: event.agent.name,
      amount: event.amount,
      hasSong: !!event.agent.songUrl,
      totalMs,
      reducedFx,
    });

    setPhase("flash");
    setShaking(true);

    // SFX choreography — each call resolves to file or synth, never blocks.
    sfx.mechanical().catch(() => {});
    const sfxBurst = window.setTimeout(() => sfx.cashBurst().catch(() => {}), CANNON_FLASH_MS + CANNON_ARM_MS);
    const sfxStinger = window.setTimeout(
      () => sfx.winStinger().catch(() => {}),
      CANNON_FLASH_MS + CANNON_ARM_MS + Math.max(0, CANNON_FIRE_MS - 250),
    );

    const tShake = window.setTimeout(() => setShaking(false), 320);
    const tArm = window.setTimeout(() => setPhase("arm"), CANNON_FLASH_MS);
    const tFire = window.setTimeout(
      () => setPhase("fire"),
      CANNON_FLASH_MS + CANNON_ARM_MS,
    );
    const tReveal = window.setTimeout(
      () => setPhase("reveal"),
      CANNON_FLASH_MS + CANNON_ARM_MS + CANNON_FIRE_MS,
    );
    const tCurtain = window.setTimeout(() => setPhase("curtain"), Math.max(0, totalMs - 500));
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

  const counterDuration = Math.min(CANNON_REVEAL_MS, CANNON_FIRE_MS);

  return (
    <AnimatePresence>
      {event && phase !== "done" && (
        <motion.div
          key={event.triggeredAt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center ${shaking ? "anim-camera-shake" : ""}`}
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(20, 29, 47, 0.95) 0%, rgba(3, 6, 13, 0.98) 75%)",
          }}
        >
          {/* Phase 1 — blue flash */}
          <AnimatePresence>
            {phase === "flash" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: CANNON_FLASH_MS / 1000,
                  times: [0, 0.3, 1],
                }}
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at center, #6cc1ff 0%, #3aa6ff 40%, transparent 70%)",
                  mixBlendMode: "screen",
                }}
              />
            )}
          </AnimatePresence>

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

          {/* Header */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
            <p className="font-sans text-xs uppercase tracking-[0.5em] text-vault-blue/70">
              vault dispatch
            </p>
            <h2
              className="mt-2 font-display text-5xl uppercase tracking-[0.18em] sm:text-6xl"
              style={{
                color: "#6cc1ff",
                textShadow:
                  "0 0 8px #3aa6ff, 0 0 24px rgba(10, 94, 194, 0.7), 0 0 64px rgba(10, 94, 194, 0.4)",
              }}
            >
              CASH OUT
            </h2>
          </div>

          {/* Cannon */}
          <motion.div
            className="absolute bottom-12 left-1/2"
            style={{ width: "min(420px, 60vw)", height: "min(280px, 40vh)" }}
            initial={{ x: "-50%", y: 40, opacity: 0 }}
            animate={{
              x: "-50%",
              y: phase === "arm" || phase === "fire" || phase === "reveal" ? 0 : 40,
              opacity: 1,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
          >
            <Cannon firing={phase === "fire"} />
          </motion.div>

          {/* Bills */}
          {(phase === "fire" || phase === "reveal" || phase === "curtain") && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {bills.map((b) => {
                // Final position computed in vh / vw approximations. We use
                // motion to interpolate transform; this stays cheap because
                // each bill is one transform-only animation.
                const distance = b.speed * b.duration; // vh travelled
                const dx = Math.sin(b.angle) * distance + b.driftX;
                const dy = -Math.cos(b.angle) * distance;
                return (
                  <motion.div
                    key={b.id}
                    className="absolute"
                    style={{
                      left: "50%",
                      // Cannon muzzle position approx — bottom 22%, center.
                      bottom: "22%",
                      width: b.size,
                      transform: `translateX(-50%) translate(0, 0) rotate(${b.rotateStart}deg)`,
                      filter:
                        b.hue > 0.7
                          ? "drop-shadow(0 0 6px rgba(207,214,228,0.55))"
                          : "drop-shadow(0 0 6px rgba(58,166,255,0.55))",
                    }}
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 0,
                      rotate: b.rotateStart,
                      scale: 0.6,
                    }}
                    animate={{
                      x: `${dx}vw`,
                      y: `${dy}vh`,
                      opacity: [0, 1, 1, 0],
                      rotate: b.rotateStart + b.spin,
                      scale: [0.6, 1, 0.95, 0.85],
                    }}
                    transition={{
                      duration: b.duration,
                      delay: b.delay,
                      times: [0, 0.15, 0.85, 1],
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <Bill size={b.size} />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Reveal: agent + amount card */}
          {(phase === "fire" || phase === "reveal" || phase === "curtain") && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: -30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.2 }}
              className="relative z-10 flex flex-col items-center gap-5 text-center"
            >
              <AgentSeal photoUrl={event.agent.photoUrl} name={event.agent.name} />
              <p
                className="font-display text-3xl uppercase tracking-[0.16em] sm:text-4xl"
                style={{
                  color: "#e7ecf5",
                  textShadow: "0 0 6px rgba(207,214,228,0.4), 0 0 18px rgba(58,166,255,0.35)",
                }}
              >
                {event.agent.name}
              </p>
              <div
                className="rounded-lg border-2 border-vault-blue bg-vault-ink/85 px-10 py-4 font-digital text-6xl shadow-vault-glow sm:text-7xl"
                style={{
                  color: "#6cc1ff",
                  textShadow: "0 0 10px #3aa6ff",
                }}
              >
                <CountUp value={event.amount} durationMs={counterDuration} />
              </div>
            </motion.div>
          )}

          {/* Curtain — vault doors close */}
          {phase === "curtain" && (
            <>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                transition={{ duration: 0.45, ease: "easeIn" }}
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
                transition={{ duration: 0.45, ease: "easeIn" }}
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
      )}
    </AnimatePresence>
  );
}

function AgentSeal({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  return (
    <div className="relative h-44 w-44 sm:h-56 sm:w-56">
      {/* Outer engraved ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(58,166,255,0.55), rgba(207,214,228,0.6), rgba(10,94,194,0.7), rgba(58,166,255,0.55))",
          padding: 6,
        }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background: "linear-gradient(180deg, #070b16 0%, #03060d 100%)",
          }}
        />
      </div>
      <div
        className="absolute inset-3 rounded-full"
        style={{
          border: "1px dashed rgba(207,214,228,0.45)",
        }}
      />
      <div className="absolute inset-5 overflow-hidden rounded-full ring-2 ring-vault-blue/70">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-vault-ink">
            <span className="font-display text-7xl text-cyan-glow">
              {name.charAt(0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
