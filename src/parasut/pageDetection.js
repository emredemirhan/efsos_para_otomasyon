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

const RELEVANT_ROUTE_PATTERN =
  /\/(?:fis-faturalar|tedarikciler|calisanlar|maaslar|salaries)(?:\/|$)/;

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

function getCandidateDocuments(primaryRoot = getActiveAppDocument()) {
  const roots = [primaryRoot, document];

  try {
    if (window.top?.document) roots.push(window.top.document);
  } catch {}

  return roots.filter((root, index) => root && roots.indexOf(root) === index);
}

function getPageEventValue(root) {
  for (const candidate of getCandidateDocuments(root)) {
    const value =
      $("input[data-tid='page'][data-ttype='event']", candidate)?.value ||
      $("input[data-tid='page']", candidate)?.value ||
      "";

    if (value) return value;
  }

  return "";
}

function classifyPaymentStage(pathname, root) {
  if (/\/calisanlar(?:\/|$)/.test(pathname)) return null;

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

function classifySalaryStage(pathname, root) {
  const pageValue = getPageEventValue(root);

  if (pageValue === "salaries.new") return "salary-form";
  if (pageValue === "salaries.show") return "salary-detail";
  if (pageValue === "employees.show") return "employee-detail";
  if (pageValue === "employees.index") return "employees";

  if (/\/(?:maaslar|salaries)\/\d+/.test(pathname)) return "salary-detail";
  if (/\/calisanlar\/\d+/.test(pathname)) return "employee-detail";
  if ($("[data-tns='employee-show']", root)) return "employee-detail";
  if ($("[data-tns='employee-index']", root)) return "employees";
  if (/\/calisanlar\/?$/.test(pathname)) return "employees";

  return null;
}

export function getPageDetectionSnapshot(root = getActiveAppDocument()) {
  const pathname = getAppPathname();
  const hasRecordId = Boolean(
    $("input[data-tid='record-id'][data-ttype='page']", root),
  );
  const hasPurchaseBillShow = Boolean($("[data-tns='purchase-bills-show']", root));
  const isExpense = matchesExpenseFormPath(pathname);
  const salaryStage = isExpense ? null : classifySalaryStage(pathname, root);
  const paymentStage =
    isExpense || salaryStage ? null : classifyPaymentStage(pathname, root);

  let flow = "idle";
  if (isExpense) flow = "expense";
  else if (salaryStage) flow = "salary";
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
    salaryStage,
    flow,
  };
}

export function isExpenseFormPage() {
  return getPageDetectionSnapshot().isExpense;
}

export function getPaymentStage() {
  return getPageDetectionSnapshot().paymentStage;
}

export function getSalaryStage() {
  return getPageDetectionSnapshot().salaryStage;
}
