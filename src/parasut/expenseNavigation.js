import { $$, getActiveAppDocument, sleep, waitFor } from "./dom.js";
import { getAppPathname, isExpenseFormPage } from "./pageDetection.js";

export function buildNewExpensePath(pathname) {
  const isSupportedPage =
    /\/(?:fis-faturalar|tedarikciler|calisanlar|maaslar|salaries)(?:\/|$)/.test(
      pathname,
    );
  if (!isSupportedPage) return "";

  const companyPrefix = pathname.match(/^\/\d+(?=\/|$)/)?.[0] || "";
  return `${companyPrefix}/fis-faturalar/yeni`;
}

function getCandidateDocuments() {
  const roots = [getActiveAppDocument(), document];

  try {
    if (window.top?.document) roots.push(window.top.document);
  } catch {}

  return roots.filter((root, index) => root && roots.indexOf(root) === index);
}

function findNewExpenseLink() {
  for (const root of getCandidateDocuments()) {
    const link = $$(`a[href*="/fis-faturalar/yeni"]`, root).find((anchor) =>
      /\/fis-faturalar\/yeni(?:\/hizli)?(?:[?#]|$)/.test(
        anchor.getAttribute("href") || "",
      ),
    );

    if (link) return link;
  }

  return null;
}

function clickAppLink(link) {
  const view = link.ownerDocument?.defaultView || window;
  const jq = (view.Ember && view.Ember.$) || view.jQuery || view.$;

  if (jq) {
    try {
      jq(link).trigger("click");
      return;
    } catch (err) {
      console.warn("[AJANS] Yeni gider linki jQuery ile açılamadı:", err);
    }
  }

  link.click();
}

function navigateDirectlyToNewExpense() {
  const root = getActiveAppDocument();
  const view = root.defaultView || window;
  const targetPath = buildNewExpensePath(getAppPathname());

  if (!targetPath) {
    throw new Error("Yeni gider formu adresi oluşturulamadı.");
  }

  view.location.assign(targetPath);
}

export async function goToNewExpenseForm() {
  if (isExpenseFormPage()) return;

  const link = findNewExpenseLink();
  if (link) clickAppLink(link);
  else navigateDirectlyToNewExpense();

  await waitFor(() => isExpenseFormPage(), 12000);
  await sleep(500);
}
