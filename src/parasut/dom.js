import { elementText, norm } from "../core/text.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isVisible(el) {
  if (!el) return false;

  const view = el.ownerDocument?.defaultView || window;
  const style = view.getComputedStyle(el);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    el.getClientRects().length > 0
  );
}

export function getActiveAppDocument() {
  const iframe = $("iframe[name='trinity-iframe'], iframe[data-type='trinity']");

  if (iframe && isVisible(iframe)) {
    try {
      if (iframe.contentDocument?.body) return iframe.contentDocument;
    } catch (err) {
      console.warn("[AJANS] Trinity iframe dokümanına erişilemedi:", err);
    }
  }

  return document;
}

export function findFillableInput(root) {
  if (!root) return null;

  const inputs = $$("input, textarea", root).filter(
    (el) => el.type !== "hidden" && el.type !== "file",
  );

  return inputs.find(isVisible) || inputs[0] || null;
}

export async function waitFor(fn, timeout = 8000, interval = 150) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = fn();
    if (result) return result;
    await sleep(interval);
  }

  throw new Error("Beklenen alan bulunamadı.");
}

export function setNativeValue(el, value, options = {}) {
  if (!el) throw new Error("Input bulunamadı.");

  const shouldBlur = options.blur !== false;
  const shouldKeyup = options.keyup !== false;
  const view = el.ownerDocument?.defaultView || window;
  const wasReadonly = el.hasAttribute("readonly");
  if (wasReadonly) el.removeAttribute("readonly");

  el.focus();

  const proto =
    el instanceof view.HTMLTextAreaElement
      ? view.HTMLTextAreaElement.prototype
      : view.HTMLInputElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

  if (setter) setter.call(el, value);
  else el.value = value;

  el.dispatchEvent(new view.Event("input", { bubbles: true }));
  el.dispatchEvent(new view.Event("change", { bubbles: true }));
  if (shouldKeyup) {
    el.dispatchEvent(new view.KeyboardEvent("keyup", { bubbles: true }));
  }

  if (shouldBlur) {
    el.dispatchEvent(new view.Event("blur", { bubbles: true }));
  }

  if (wasReadonly) el.setAttribute("readonly", "");
}

export function sendKey(el, key) {
  if (!el) return;

  const view = el.ownerDocument?.defaultView || window;
  const keyCode = key === "Enter" ? 13 : 0;
  const common = {
    key,
    code: key,
    which: keyCode,
    keyCode,
    bubbles: true,
    cancelable: true,
  };

  el.dispatchEvent(new view.KeyboardEvent("keydown", common));
  el.dispatchEvent(new view.KeyboardEvent("keypress", common));
  el.dispatchEvent(new view.KeyboardEvent("keyup", common));
}

export function clickWithoutDefaultNavigation(el) {
  if (!el) return;

  const doc = el.ownerDocument || document;
  const view = doc.defaultView || window;

  const preventOwnDefault = (event) => {
    if (event.target === el || el.contains?.(event.target)) {
      event.preventDefault();
    }
  };

  doc.addEventListener("click", preventOwnDefault, true);
  try {
    el.dispatchEvent(
      new view.MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view,
        button: 0,
      }),
    );
    el.dispatchEvent(
      new view.MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view,
        button: 0,
      }),
    );
    el.click();
  } finally {
    doc.removeEventListener("click", preventOwnDefault, true);
  }
}

export function getVisibleDropdownRoots(root = getActiveAppDocument()) {
  const roots = $$(
    ".dropdownContent, .ember-basic-dropdown-content, .ember-power-select-dropdown, [role='listbox']",
    root,
  ).filter(isVisible);

  return roots.length ? roots : [root];
}

export function findVisibleActionByText(text, options = {}) {
  const wanted = norm(text);
  const selector = options.selector || "button, a";
  const root = options.root || getActiveAppDocument();

  return $$(selector, root)
    .filter(isVisible)
    .find((el) => {
      if (options.excludeSave && el.getAttribute("data-tid") === "save") {
        return false;
      }

      return norm(elementText(el)) === wanted;
    });
}
