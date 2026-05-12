import { $ } from "../parasut/dom.js";
import { isPanelMinimized } from "./storage.js";
import { PANEL_COLORS } from "./panelTheme.js";

const { ACCENT, ACCENT_DARK, MUTED } = PANEL_COLORS;

export function setStatus(message, isError = false) {
  const wrapper = $("#ajans-gider-status-wrapper");
  const status = $("#ajans-gider-status");
  const icon = $("#ajans-gider-status-icon");

  if (!wrapper || !status || !icon) return;

  const text = String(message || "").trim();

  if (!text || text === "Hazır." || text === "Hazır") {
    wrapper.hidden = true;
    status.textContent = "";
    return;
  }

  wrapper.hidden = false;
  status.textContent = text;

  if (isError) {
    icon.textContent = "!";
    icon.style.color = "#b42318";
    status.style.color = "#b42318";
  } else {
    icon.textContent = "·";
    icon.style.color = MUTED;
    status.style.color = MUTED;
  }
}

export function setFillButtonLoading(button, loading) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Dolduruluyor..." : "Ana Gideri Doldur";
  button.style.opacity = loading ? "0.65" : "1";
  button.style.cursor = loading ? "not-allowed" : "pointer";
  button.style.background = loading ? ACCENT_DARK : ACCENT;
}

export function applyMinimizedState(panel, body, button) {
  const minimized = isPanelMinimized();

  body.style.display = minimized ? "none" : "block";
  button.title = minimized ? "Aç" : "Küçült";
  button.setAttribute("aria-label", minimized ? "Aç" : "Küçült");
  button.textContent = minimized ? "+" : "–";
  panel.style.width = minimized ? "240px" : "360px";
}
