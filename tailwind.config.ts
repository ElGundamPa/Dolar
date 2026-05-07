import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Vault palette — black/anthracite + electric blue + silver/platinum metallic.
 *
 * `vault.*` is the new identity (banknote engraving + tech-blue).
 * `kriptex.*` is kept as a backwards-compat alias mapping to the new tokens
 *   so any leftover className from the original repo still resolves.
 */
const vault = {
  ink: "#03060d",         // base background, deepest black
  obsidian: "#070b16",    // body fill
  graphite: "#0c121f",    // surface
  steel: "#141d2f",       // elevated surface
  iron: "#1d2840",        // borders / hover
  silver: "#cfd6e4",      // metallic text
  platinum: "#e7ecf5",    // brightest text
  // Electric blue ramp — high contrast tech accent.
  blue: "#3aa6ff",
  "blue-bright": "#6cc1ff",
  "blue-deep": "#0a5ec2",
  cyan: "#5eeaff",
  // Premium accents inspired by the engraved banknote.
  parchment: "#e9d9b3",   // warm aged paper highlight (very subtle)
  emerald: "#1bbf8a",     // confirmation / win
  danger: "#ff4d6a",
};

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault,
        // Backwards-compat aliases — same shape as the original kriptex palette
        // pointing to the new vault tokens. Lets any stale className resolve.
        kriptex: {
          navy: vault.obsidian,
          "navy-deep": vault.ink,
          "navy-mid": vault.graphite,
          steel: vault.steel,
          orange: vault.blue,
          "orange-bright": vault["blue-bright"],
          "orange-deep": vault["blue-deep"],
          ember: vault["blue-deep"],
          cyan: vault.cyan,
          "cyan-deep": vault["blue-deep"],
          cream: vault.platinum,
          danger: vault.danger,
          success: vault.emerald,
        },
      },
      fontFamily: {
        display: ['"Cinzel"', '"Playfair Display"', "serif"],
        digital: ['"JetBrains Mono"', '"IBM Plex Mono"', "monospace"],
        sans: ['"Inter"', '"Manrope"', "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "vault-grid":
          "linear-gradient(rgba(58,166,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(58,166,255,0.08) 1px, transparent 1px)",
      },
      boxShadow: {
        "vault-glow": "0 0 28px rgba(58,166,255,0.35)",
        "vault-rim": "inset 0 0 0 1px rgba(207,214,228,0.18)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
