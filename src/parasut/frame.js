import { PANEL_ID } from "../config/constants.js";
import { $$ } from "./dom.js";

export function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isTrinityRenderFrame() {
  try {
    return new URLSearchParams(window.location.search).get(
      "render_trinity_iframe",
    ) === "true";
  } catch {
    return window.location.href.includes("render_trinity_iframe=true");
  }
}

export function shouldRunInThisFrame() {
  return !isIframe() && !isTrinityRenderFrame();
}

export function removeDuplicatePanels() {
  $$(`#${PANEL_ID}`).forEach((panel, index) => {
    if (index > 0) panel.remove();
  });
}
