import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Verify the vault background is reachable; otherwise the CSS fallback
// (gradient defined in --bg-fallback) takes over and we leave a console warning.
const BG_PATH = "/bg-vault.svg";
const probe = new Image();
probe.onerror = () => {
  console.warn(
    `[bg] Could not load ${BG_PATH}. Falling back to gradient. ` +
      "Make sure the file exists in /public.",
  );
  document.documentElement.classList.add("bg-fallback");
};
probe.src = BG_PATH;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
