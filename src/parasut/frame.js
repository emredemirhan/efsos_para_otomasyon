import { PANEL_ID } from "../config/constants.js";
import { $$ } from "./dom.js";

export function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function shouldRunInThisFrame() {
  return !isIframe();
}

export function removeDuplicatePanels() {
  $$(`#${PANEL_ID}`).forEach((panel, index) => {
    if (index > 0) panel.remove();
  });
}
