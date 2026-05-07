# Sounds (optional drop-in replacement)

By default, `useJackpotSfx` synthesizes the 3 SFX (mechanical start, cash burst, stinger) directly with the Web Audio API — **no binary files required**. This guarantees the app works offline and with any device.

If you want richer studio-mixed audio, drop these files into this folder and the hook will prefer them automatically:

| File | When it plays | Suggested duration |
|---|---|---|
| `sfx-mechanical-start.mp3` | Stage 1 — cannon arming / lock-and-load | 0.4 – 0.8 s |
| `sfx-cash-burst.mp3`       | Stage 2 — bills firing out | 1.5 – 2.5 s |
| `sfx-win-stinger.mp3`      | Stage 3 — premium "ka-ching" / win confirmation | 0.8 – 1.5 s |

Master volume and mute are controlled from `localStorage`:
- `dolar.audio.muted` (`"1"` or `"0"`)
- `dolar.audio.master` (number `0`–`1`)

You can also wire the volume + mute UI to a settings panel — see `src/hooks/useJackpotSfx.ts`.
