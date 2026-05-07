/**
 * Branding configuration.
 *
 * To rebrand without touching components:
 *   - VITE_BRAND_NAME       — display name in headers, login, browser tab.
 *   - VITE_BRAND_LOGO       — path inside /public (e.g. /logos/your-logo.svg).
 *   - VITE_BRAND_TAGLINE    — line under the brand on the start screen.
 *   - VITE_BRAND_MONOGRAM   — 1–3 chars used by the SVG fallback if no logo.
 *
 * Or edit the defaults below.
 */
const env = import.meta.env;

export interface BrandConfig {
  /** Full display name shown in headers and login. */
  name: string;
  /** Short tagline shown under the brand on the start screen. */
  tagline: string;
  /** Public URL of the logo image. `null` renders the SVG monogram fallback. */
  logoPath: string | null;
  /** 1–3 character monogram used by the SVG fallback. */
  monogram: string;
  /** Tab title shown in the browser. */
  documentTitle: string;
  /** Short marker shown above the brand on the start screen. */
  hallmark: string;
}

const NAME = env.VITE_BRAND_NAME?.trim() || "DolarDashboard";

export const BRAND: BrandConfig = {
  name: NAME,
  tagline:
    env.VITE_BRAND_TAGLINE?.trim() ||
    "Money machine · Trading vault · Real time",
  logoPath: env.VITE_BRAND_LOGO?.trim() || "/logos/dolar-dashboard.svg",
  monogram: env.VITE_BRAND_MONOGRAM?.trim() || "$",
  documentTitle: NAME,
  hallmark: "— vault floor —",
};
