export const POLLING_INTERVAL_MS = 10_000;
export const JACKPOT_DURATION_MS = 10_000;
export const JACKPOT_AUDIO_FADE_MS = 2_000;

/**
 * Money-gun stage timing (ms from event start).
 * Phases run sequentially: flash → arm → fire → reveal → curtain.
 *
 *   flash:  brief blue flash + camera shake.
 *   arm:    gun rises into firing position from below; mechanical SFX.
 *   fire:   continuous burst — bills stream upward toward the name,
 *           counter ramps from 0 to amount, cashBurst SFX plays.
 *   reveal: bills settle/fade, counter holds at final value, winStinger SFX.
 */
export const CANNON_FLASH_MS = 220;
export const CANNON_ARM_MS = 600;
export const CANNON_FIRE_MS = 1_700;
export const CANNON_REVEAL_MS = 1_400;

export const PROCESSED_SALES_LIMIT = 1_000;
export const HOUSE_NAME = "DOLAR DASHBOARD";
