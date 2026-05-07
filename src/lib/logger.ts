const enabled = import.meta.env.DEV;

export const logger = {
  info: (...args: unknown[]) => {
    if (enabled) console.log("[dolar]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled) console.warn("[dolar]", ...args);
  },
  error: (...args: unknown[]) => {
    console.error("[dolar]", ...args);
  },
};
