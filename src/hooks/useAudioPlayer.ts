import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

interface PlayOptions {
  url: string;
  startSeconds?: number;
  fadeOutMs?: number;
  totalDurationMs?: number;
  initialVolume?: number;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const fadeRafRef = useRef<number | null>(null);

  const cleanup = () => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
  };

  useEffect(() => () => cleanup(), []);

  const play = ({ url, startSeconds = 0, fadeOutMs = 2000, totalDurationMs = 10_000, initialVolume = 0.9 }: PlayOptions) => {
    cleanup();
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.volume = initialVolume;
    audioRef.current = audio;

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
          // Some browsers ignore currentTime before playback starts.
          if (audio.currentTime < startSeconds - 0.05) {
            setStart();
          }
        })
        .catch((err) => logger.warn("Audio play blocked", err));
    }

    // Schedule fade out near the end.
    const fadeStartAt = Math.max(0, totalDurationMs - fadeOutMs);
    fadeTimerRef.current = window.setTimeout(() => {
      const startVol = audio.volume;
      const fadeStart = performance.now();
      const tick = () => {
        const elapsed = performance.now() - fadeStart;
        const k = Math.min(1, elapsed / fadeOutMs);
        audio.volume = Math.max(0, startVol * (1 - k));
        if (k < 1) {
          fadeRafRef.current = requestAnimationFrame(tick);
        }
      };
      fadeRafRef.current = requestAnimationFrame(tick);
    }, fadeStartAt);

    stopTimerRef.current = window.setTimeout(() => cleanup(), totalDurationMs + 100);
  };

  const stop = () => cleanup();

  return { play, stop };
}
