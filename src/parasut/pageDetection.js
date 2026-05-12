import { $, getActiveAppDocument } from "./dom.js";

function getAppPathname() {
  try {
    return window.top?.location?.pathname || location.pathname;
  } catch {
    return location.pathname;
  }
}

export function isExpenseFormPage() {
  return /\/fis-faturalar\/yeni(?:\/hizli)?\/?$/.test(
    getAppPathname(),
  );
}

export function isPurchaseBillShowPage(root = getActiveAppDocument()) {
  const pathname = getAppPathname();

  return (
    /\/fis-faturalar\/\d+\/?$/.test(pathname) ||
    (/\/fis-faturalar(?:\/|$)/.test(pathname) &&
      (Boolean($("input[data-tid='record-id'][data-ttype='page']", root)) ||
        Boolean($("[data-tns='purchase-bills-show']", root))))
  );
}
