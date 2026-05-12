import { PANEL_COLORS } from "./panelTheme.js";

const { ACCENT, ACCENT_DARK, TEXT, MUTED, BORDER, SOFT_BG } = PANEL_COLORS;

export function setupHoverEffects(panel) {
  const hoverableButtons = panel.querySelectorAll(
    "#ajans-gider-help-toggle, #ajans-gider-minimize",
  );

  hoverableButtons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      button.style.background = "#f3f4f6";
      button.style.color = TEXT;
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
      button.style.color = MUTED;
    });
  });

  const stepButtons = panel.querySelectorAll(
    "#ajans-gider-prev, #ajans-gider-next",
  );

  stepButtons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      if (button.disabled) return;
      button.style.background = SOFT_BG;
      button.style.borderColor = "#cbd5e1";
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "#ffffff";
      button.style.borderColor = BORDER;
    });
  });

  const fillButton = panel.querySelector("#ajans-gider-fill");
  if (fillButton) {
    fillButton.addEventListener("mouseenter", () => {
      if (fillButton.disabled) return;
      fillButton.style.background = ACCENT_DARK;
    });
    fillButton.addEventListener("mouseleave", () => {
      if (fillButton.disabled) return;
      fillButton.style.background = ACCENT;
    });
  }

  const editButton = panel.querySelector("#ajans-gider-edit-data");
  if (editButton) {
    editButton.addEventListener("mouseenter", () => {
      editButton.style.color = ACCENT_DARK;
    });
    editButton.addEventListener("mouseleave", () => {
      editButton.style.color = ACCENT;
    });
  }

  const clearButton = panel.querySelector("#ajans-gider-clear");
  if (clearButton) {
    clearButton.addEventListener("mouseenter", () => {
      clearButton.style.color = TEXT;
    });
    clearButton.addEventListener("mouseleave", () => {
      clearButton.style.color = MUTED;
    });
  }

  const select = panel.querySelector("#ajans-gider-row-select");
  if (select) {
    select.addEventListener("mouseenter", () => {
      select.style.borderColor = "#cbd5e1";
    });
    select.addEventListener("mouseleave", () => {
      select.style.borderColor = BORDER;
    });
    select.addEventListener("focus", () => {
      select.style.borderColor = ACCENT;
    });
    select.addEventListener("blur", () => {
      select.style.borderColor = BORDER;
    });
  }
}
