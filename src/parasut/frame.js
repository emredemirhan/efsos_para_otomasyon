import { PANEL_ID } from "../config/constants.js";
import { $, $$ } from "./dom.js";

export function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function hasTrinityIframe() {
  return Boolean($("iframe[name='trinity-iframe'], iframe[data-type='trinity']"));
}

export function hasPanelInTrinityIframe() {
  return $$("iframe[name='trinity-iframe'], iframe[data-type='trinity']").some(
    (iframe) => {
      try {
        return Boolean(iframe.contentDocument?.querySelector(`#${PANEL_ID}`));
      } catch {
        return false;
      }
    },
  );
}

export function shouldRunInThisFrame() {
  return isIframe() || !hasPanelInTrinityIframe();
}

export function removeDuplicatePanels() {
  $$(`#${PANEL_ID}`).forEach((panel, index) => {
    if (index > 0) panel.remove();
  });
}
