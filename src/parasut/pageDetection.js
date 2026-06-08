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

const RELEVANT_ROUTE_PATTERN = /\/(?:fis-faturalar|tedarikciler)(?:\/|$)/;

export function getAppPathname() {
  const currentPathname = getWindowPathname(window);
  const topPathname = getWindowPathname(window.top);
  const iframePathnames = getTrinityIframePathnames();

  // Paraşüt'ün gerçek görünümü trinity-iframe içinde render ediliyor; üst
  // pencere URL'i alt sayfaya (örn. /tedarikciler/{id}) geçmiyor. Bu yüzden
  // iframe'in ilgili path'ini her şeyden önce değerlendiriyoruz.
  const relevantIframe = iframePathnames.find((pathname) =>
    RELEVANT_ROUTE_PATTERN.test(pathname),
  );
  if (relevantIframe) return relevantIframe;

  return (
    [currentPathname, topPathname].find((pathname) =>
      RELEVANT_ROUTE_PATTERN.test(pathname),
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

function classifyPaymentStage(pathname, root) {
  // URL'de id varsa kesindir (uygulama URL'yi güncellediğinde).
  if (/\/fis-faturalar\/\d+/.test(pathname) && !matchesExpenseFormPath(pathname)) {
    return "bill";
  }
  if (/\/tedarikciler\/\d+/.test(pathname)) return "supplier-detail";

  // Paraşüt detay sayfasını çoğu zaman üst URL'yi değiştirmeden (gömülü/legacy
  // görünüm) yüklüyor. Bu yüzden URL'deki "/tedarikciler" liste eşleşmesinden
  // ÖNCE render edilen içeriğe bakıyoruz.
  if ($("[data-tns='purchase-bills-show']", root)) return "bill";
  if (
    $("[data-test-contact-show-header-name]", root) ||
    $("[data-tns='supplier-show']", root)
  ) {
    return "supplier-detail";
  }

  if ($("[data-tns='supplier-index']", root)) return "suppliers";
  if (/\/tedarikciler\/?$/.test(pathname)) return "suppliers";

  return null;
}

export function getPageDetectionSnapshot(root = getActiveAppDocument()) {
  const pathname = getAppPathname();
  const hasRecordId = Boolean(
    $("input[data-tid='record-id'][data-ttype='page']", root),
  );
  const hasPurchaseBillShow = Boolean($("[data-tns='purchase-bills-show']", root));
  const isExpense = matchesExpenseFormPath(pathname);
  const paymentStage = isExpense ? null : classifyPaymentStage(pathname, root);

  let flow = "idle";
  if (isExpense) flow = "expense";
  else if (paymentStage) flow = "payment";

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
    paymentStage,
    flow,
  };
}

export function isExpenseFormPage() {
  return getPageDetectionSnapshot().isExpense;
}

export function getPaymentStage() {
  return getPageDetectionSnapshot().paymentStage;
}
