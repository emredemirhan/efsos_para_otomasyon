import { $ } from "../parasut/dom.js";
import { isPanelMinimized } from "./storage.js";
import { PANEL_COLORS } from "./panelTheme.js";

const { ACCENT, ACCENT_DARK, MUTED } = PANEL_COLORS;

export function setStatus(message, tone = "info") {
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

  const statusTone = tone === true ? "error" : tone;

  wrapper.style.background = "transparent";
  wrapper.style.border = "0";
  wrapper.style.borderRadius = "0";
  wrapper.style.padding = "0";

  if (statusTone === "error") {
    icon.textContent = "!";
    icon.style.color = "#b42318";
    status.style.color = "#b42318";
  } else if (statusTone === "success") {
    wrapper.style.background = "#ecfdf3";
    wrapper.style.border = "1px solid #abefc6";
    wrapper.style.borderRadius = "8px";
    wrapper.style.padding = "8px 10px";
    icon.textContent = "OK";
    icon.style.color = "#067647";
    status.style.color = "#067647";
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

export function setPayButtonLoading(button, loading) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Çalışıyor..." : "Ödemeyi Başlat";
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
