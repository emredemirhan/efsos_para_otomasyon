import { $, $$, getActiveAppDocument, isVisible } from "./dom.js";

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

function hasVisiblePaymentForm(root) {
  return $$("[data-tns='add-payment']", root).some(isVisible);
}

function matchesExpenseFormPath(pathname) {
  return /\/fis-faturalar\/yeni(?:\/hizli)?\/?$/.test(pathname);
}

function matchesPurchaseBillShowPath(pathname) {
  return /\/fis-faturalar\/\d+(?:\/.*)?\/?$/.test(pathname);
}

export function getPageDetectionSnapshot(root = getActiveAppDocument()) {
  const pathname = getAppPathname();
  const hasRecordId = Boolean(
    $("input[data-tid='record-id'][data-ttype='page']", root),
  );
  const hasPurchaseBillShow = Boolean($("[data-tns='purchase-bills-show']", root));
  const hasPaymentForm = hasVisiblePaymentForm(root);
  const isExpense = matchesExpenseFormPath(pathname);
  const isPurchase =
    matchesPurchaseBillShowPath(pathname) ||
    (/\/fis-faturalar(?:\/|$)/.test(pathname) &&
      (hasRecordId || hasPurchaseBillShow || hasPaymentForm));

  return {
    href: location.href,
    pathname,
    currentPathname: getWindowPathname(window),
    topPathname: getWindowPathname(window.top),
    iframePathnames: getTrinityIframePathnames(),
    activeDocumentPathname: getWindowPathname(root.defaultView),
    hasRecordId,
    hasPurchaseBillShow,
    hasPaymentForm,
    isExpense,
    isPurchase,
    flow: isExpense ? "expense" : isPurchase ? "payment" : "idle",
  };
}

export function isExpenseFormPage() {
  return getPageDetectionSnapshot().isExpense;
}

export function isPurchaseBillShowPage(root = getActiveAppDocument()) {
  return getPageDetectionSnapshot(root).isPurchase;
}
