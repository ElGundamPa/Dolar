# Sounds — synthesized only

The 3 jackpot SFX (mechanical / cashBurst / winStinger) are **synthesized
live** with the Web Audio API in `src/hooks/useJackpotSfx.ts`. There are no
binary audio files involved.

The previous version of this hook had a "drop-in MP3 override" feature where
files like `sfx-mechanical-start.mp3` here would be loaded instead of the
synth. That feature was **removed** because each missed file (404) created an
HTMLAudio element in error state, which on Chrome shifts the global audio
decoder configuration into a fallback path that applies aggressive
normalization to subsequent audio loads — audible as a vocal-isolation /
voice-forward artifact on agent songs.

## To customize the SFX

Edit the `mechanical()`, `cashBurst()`, and `winStinger()` functions in
`src/hooks/useJackpotSfx.ts`. Tweak the oscillator frequencies, durations,
gains, or filter band-pass ranges directly. They use `beep()`, `slide()`, and
`noise()` helpers in the same file.

## Master volume + mute

Configurable from the admin **Settings** tab. Persists in `localStorage`:

- `dolar.audio.muted`  — `"1"` or `"0"`
- `dolar.audio.master` — number `0`–`1`
