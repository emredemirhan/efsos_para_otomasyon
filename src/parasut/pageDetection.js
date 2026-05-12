import { $, $$, getActiveAppDocument } from "./dom.js";

function getWindowPathname(targetWindow) {
  try {
    return targetWindow?.location?.pathname || "";
  } catch {
    return "";
  }
}

function getTrinityIframePathnames() {
  return $$("iframe[name='trinity-iframe'], iframe[data-type='trinity']")
    .map((iframe) => getWindowPathname(iframe.contentWindow))
    .filter(Boolean);
}

export function getAppPathname() {
  const currentPathname = getWindowPathname(window);
  const topPathname = getWindowPathname(window.top);
  const iframePathnames = getTrinityIframePathnames();

  return (
    [currentPathname, topPathname, ...iframePathnames].find((pathname) =>
      /\/fis-faturalar(?:\/|$)/.test(pathname),
    ) ||
    iframePathnames[0] ||
    topPathname ||
    currentPathname ||
    location.pathname
  );
}

function matchesExpenseFormPath(pathname) {
  return /\/fis-faturalar\/yeni(?:\/hizli)?\/?$/.test(pathname);
}

export function getPageDetectionSnapshot(root = getActiveAppDocument()) {
  const pathname = getAppPathname();
  const hasRecordId = Boolean(
    $("input[data-tid='record-id'][data-ttype='page']", root),
  );
  const hasPurchaseBillShow = Boolean($("[data-tns='purchase-bills-show']", root));
  const isExpense = matchesExpenseFormPath(pathname);

  return {
    href: location.href,
    pathname,
    currentPathname: getWindowPathname(window),
    topPathname: getWindowPathname(window.top),
    iframePathnames: getTrinityIframePathnames(),
    activeDocumentPathname: getWindowPathname(root.defaultView),
    hasRecordId,
    hasPurchaseBillShow,
    isExpense,
    flow: isExpense ? "expense" : "idle",
  };
}

export function isExpenseFormPage() {
  return getPageDetectionSnapshot().isExpense;
}
