import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

/**
 * Money-gun SFX — pure Web Audio synthesis. No file probing, no HTMLAudio
 * elements, no fetches. This matches the architecture of the original repo
 * exactly (which is known to coexist cleanly with songs played by
 * useAudioPlayer).
 *
 * Three stages, called by JackpotOverlay:
 *   - mechanical()  — short servo / lock-and-load
 *   - cashBurst()   — bills firing out (paper rustle + bass thump + chips)
 *   - winStinger()  — premium "vault confirmation" hit
 *
 * Master volume + global mute live in localStorage:
 *   - dolar.audio.muted   "1" | "0"
 *   - dolar.audio.master  number 0–1
 */

const STORAGE_MUTE = "dolar.audio.muted";
const STORAGE_MASTER = "dolar.audio.master";

const readMuted = () => {
  try {
    return localStorage.getItem(STORAGE_MUTE) === "1";
  } catch {
    return false;
  }
};

const readMaster = () => {
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_MASTER) ?? "");
    if (isNaN(v)) return 0.6;
    return Math.max(0, Math.min(1, v));
  } catch {
    return 0.6;
  }
};

export function useJackpotSfx() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const activeNodes = useRef<Set<AudioScheduledSourceNode>>(new Set());

  const prefersReducedMotion = () => {
    try {
      return (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  };

  const ensureCtx = () => {
    if (prefersReducedMotion()) return null;
    if (readMuted()) return null;
    if (!ctxRef.current) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctxRef.current = new Ctx();
        const master = ctxRef.current.createGain();
        master.gain.value = readMaster();
        master.connect(ctxRef.current.destination);
        masterRef.current = master;
      } catch (err) {
        logger.warn("Web Audio init failed", err);
        return null;
      }
    }
    if (masterRef.current) {
      masterRef.current.gain.value = readMaster();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  };

  const beep = (
    freq: number,
    startOffset: number,
    durationMs: number,
    type: OscillatorType = "square",
    peakGain = 0.35,
  ) => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.05);
    activeNodes.current.add(osc);
    osc.onended = () => activeNodes.current.delete(osc);
  };

  const slide = (
    fromHz: number,
    toHz: number,
    startOffset: number,
    durationMs: number,
    type: OscillatorType = "sawtooth",
    peakGain = 0.3,
  ) => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, now);
    osc.frequency.exponentialRampToValueAtTime(toHz, now + durationMs / 1000);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.05);
    activeNodes.current.add(osc);
    osc.onended = () => activeNodes.current.delete(osc);
  };

  /** Short noise burst — used for paper rustle / cash sweep. */
  const noise = (
    startOffset: number,
    durationMs: number,
    peakGain = 0.18,
    bandHz: { lo: number; hi: number } | null = null,
  ) => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime + startOffset;
    const seconds = durationMs / 1000;
    const buffer = ctx.createBuffer(
      1,
      Math.max(1, ctx.sampleRate * seconds),
      ctx.sampleRate,
    );
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++)
      channel[i] = (Math.random() * 2 - 1) * 0.9;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    let last: AudioNode = src;
    if (bandHz) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = bandHz.lo;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = bandHz.hi;
      last.connect(hp);
      hp.connect(lp);
      last = lp;
    }
    last.connect(gain).connect(master);
    src.start(now);
    src.stop(now + seconds + 0.05);
    activeNodes.current.add(src);
    src.onended = () => activeNodes.current.delete(src);
  };

  /** Stage 1 — mechanical "lock and load". */
  const mechanical = useCallback(() => {
    if (!ensureCtx()) return;
    beep(180, 0, 80, "square", 0.32);
    beep(140, 0.09, 80, "square", 0.28);
    slide(380, 120, 0.18, 280, "sawtooth", 0.18);
    noise(0.08, 90, 0.06, { lo: 1500, hi: 5000 });
  }, []);

  /** Stage 2 — cash bursting out of the gun. */
  const cashBurst = useCallback(() => {
    if (!ensureCtx()) return;
    beep(70, 0, 220, "sine", 0.55);
    beep(110, 0.02, 180, "sine", 0.32);
    noise(0.0, 1100, 0.22, { lo: 800, hi: 4200 });
    for (let i = 0; i < 14; i++) {
      const f = 1400 + Math.random() * 2400;
      beep(f, 0.05 + i * 0.06 + Math.random() * 0.03, 50, "triangle", 0.12);
    }
  }, []);

  /** Stage 3 — premium win confirmation stinger. */
  const winStinger = useCallback(() => {
    if (!ensureCtx()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => beep(f, i * 0.04, 320, "triangle", 0.32));
    slide(220, 1320, 0, 600, "sawtooth", 0.15);
    for (let i = 0; i < 8; i++) {
      const f = 1800 + Math.random() * 1600;
      beep(f, 0.18 + i * 0.05, 60, "sine", 0.1);
    }
  }, []);

  const stop = useCallback(() => {
    activeNodes.current.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    activeNodes.current.clear();
  }, []);

  const setMuted = useCallback(
    (muted: boolean) => {
      try {
        localStorage.setItem(STORAGE_MUTE, muted ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (muted) stop();
    },
    [stop],
  );

  const setMaster = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    try {
      localStorage.setItem(STORAGE_MASTER, String(clamped));
    } catch {
      /* ignore */
    }
    if (masterRef.current) masterRef.current.gain.value = clamped;
  }, []);

  useEffect(
    () => () => {
      stop();
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
      masterRef.current = null;
    },
    [stop],
  );

  return {
    mechanical,
    cashBurst,
    winStinger,
    stop,
    setMuted,
    setMaster,
    isMuted: () => readMuted(),
    getMaster: () => readMaster(),
  };
}
