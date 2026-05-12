import { $, $$, getActiveAppDocument, isVisible } from "./dom.js";

function getWindowPathname(targetWindow) {
  try {
    return targetWindow?.location?.pathname || "";
  } catch {
    return "";
  }
}

function getAppPathname() {
  const currentPathname = getWindowPathname(window);
  const topPathname = getWindowPathname(window.top);

  return (
    [currentPathname, topPathname].find((pathname) =>
      /\/fis-faturalar(?:\/|$)/.test(pathname),
    ) ||
    topPathname ||
    currentPathname ||
    location.pathname
  );
}

function hasVisiblePaymentForm(root) {
  return $$("[data-tns='add-payment']", root).some(isVisible);
}

export function isExpenseFormPage() {
  return /\/fis-faturalar\/yeni(?:\/hizli)?\/?$/.test(
    getAppPathname(),
  );
}

export function isPurchaseBillShowPage(root = getActiveAppDocument()) {
  const pathname = getAppPathname();

  return (
    /\/fis-faturalar\/\d+(?:\/.*)?\/?$/.test(pathname) ||
    (/\/fis-faturalar(?:\/|$)/.test(pathname) &&
      (Boolean($("input[data-tid='record-id'][data-ttype='page']", root)) ||
        Boolean($("[data-tns='purchase-bills-show']", root)) ||
        hasVisiblePaymentForm(root)))
  );
}
