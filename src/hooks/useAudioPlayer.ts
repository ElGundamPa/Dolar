import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

interface PlayOptions {
  url: string;
  startSeconds?: number;
  fadeOutMs?: number;
  totalDurationMs?: number;
  initialVolume?: number;
}

/**
 * Plays an MP3 by routing it through Web Audio API
 * (HTMLAudio → MediaElementAudioSourceNode → GainNode → AudioContext.destination).
 *
 * Why this matters — the previous "vocal isolation / bad quality" symptom:
 *
 *   When an HTMLAudio element plays directly through the browser's media path,
 *   the browser routes it through the OS audio session in "media" mode. Some
 *   environments apply DSP at this stage:
 *     - Windows Voice Clarity / Voice Isolation
 *     - Realtek / Conexant "voice enhancement" modes
 *     - macOS Spatial Audio downmix
 *     - Chrome's audio policy enhancements when a "voice" use-case is detected
 *   These pathways tend to boost the vocal band (200–3500 Hz) and attenuate
 *   bass and presence, sounding exactly like vocal-only / bad-quality playback.
 *
 *   By creating an AudioContext and pulling the audio data through
 *   `createMediaElementSource()`, the playback bypasses the OS media-session
 *   path entirely. The decoded PCM is rendered directly through Web Audio,
 *   which does NOT trigger voice-enhancement DSP. The song plays bit-exact.
 *
 * Implementation notes:
 *   - `crossOrigin = "anonymous"` is REQUIRED. Without it, the browser marks
 *     the audio as "tainted" and `createMediaElementSource()` produces silence.
 *   - Each play() creates a fresh AudioContext; cleanup() closes it. This
 *     keeps the SFX hook (useJackpotSfx) and the song player isolated and
 *     avoids accidental cross-routing.
 *   - Volume + fade-out run on the GainNode, not on `audio.volume`. This is
 *     the cleanest way to attenuate within the Web Audio graph.
 */
export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const cleanup = () => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current.src = "";
      audioRef.current.removeAttribute("src");
      try {
        audioRef.current.load();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
    }
    if (gainRef.current) {
      try {
        gainRef.current.disconnect();
      } catch {
        /* ignore */
      }
      gainRef.current = null;
    }
    if (ctxRef.current) {
      try {
        ctxRef.current.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
    }
  };

  useEffect(() => () => cleanup(), []);

  const play = ({
    url,
    startSeconds = 0,
    fadeOutMs = 2000,
    totalDurationMs = 10_000,
    initialVolume = 0.9,
  }: PlayOptions) => {
    cleanup();

    const audio = new Audio(url);
    // Required so the browser exposes the decoded PCM to Web Audio.
    // Without this, createMediaElementSource() produces silence.
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    let useWebAudio = false;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = initialVolume;
      source.connect(gain).connect(ctx.destination);
      ctxRef.current = ctx;
      sourceRef.current = source;
      gainRef.current = gain;
      useWebAudio = true;
    } catch (err) {
      // Fallback to plain HTMLAudio if Web Audio init fails (very old browsers,
      // privacy mode where AudioContext is throttled, etc.). Sets audio.volume
      // directly — same as the original repo's behavior.
      logger.warn("Web Audio routing unavailable, falling back to HTMLAudio", err);
      audio.volume = initialVolume;
    }

    const setStart = () => {
      try {
        audio.currentTime = startSeconds;
      } catch (err) {
        logger.warn("Could not seek audio", err);
      }
    };

    audio.addEventListener("loadedmetadata", setStart, { once: true });

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          if (audio.currentTime < startSeconds - 0.05) {
            setStart();
          }
        })
        .catch((err) => logger.warn("Audio play blocked", err));
    }

    // Fade-out scheduled on the GainNode (or audio.volume as fallback).
    if (fadeOutMs > 0) {
      const fadeStartAt = Math.max(0, totalDurationMs - fadeOutMs);
      window.setTimeout(() => {
        if (useWebAudio && gainRef.current && ctxRef.current) {
          const ctx = ctxRef.current;
          const gain = gainRef.current;
          const now = ctx.currentTime;
          // Snapshot current value to start the ramp from where we are.
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + fadeOutMs / 1000);
        } else {
          // HTMLAudio fallback — rAF-driven volume fade.
          const a = audioRef.current;
          if (!a) return;
          const startVol = a.volume;
          const fadeStart = performance.now();
          const tick = () => {
            if (!audioRef.current) return;
            const elapsed = performance.now() - fadeStart;
            const k = Math.min(1, elapsed / fadeOutMs);
            audioRef.current.volume = Math.max(0, startVol * (1 - k));
            if (k < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }, fadeStartAt);
    }

    stopTimerRef.current = window.setTimeout(() => cleanup(), totalDurationMs + 100);
  };

  const stop = () => cleanup();

  return { play, stop };
}
