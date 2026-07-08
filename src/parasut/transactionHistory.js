import { elementText, norm } from "../core/text.js";
import { $, $$, getActiveAppDocument, isVisible, sleep, waitFor } from "./dom.js";

function hrefPath(anchor) {
  return (anchor.getAttribute("href") || "").split("#")[0].split("?")[0];
}

function hrefSearch(anchor) {
  const href = anchor.getAttribute("href") || "";
  const query = href.split("#")[0].split("?")[1] || "";
  return query ? `?${query}` : "";
}

function findByText(elements, wanted) {
  const target = norm(wanted);
  return (
    elements.find((el) => norm(elementText(el)) === target) ||
    elements.find((el) => norm(elementText(el)).includes(target)) ||
    elements.find((el) => target.includes(norm(elementText(el)))) ||
    null
  );
}

function pickAnchorByText(anchors, wanted, labelSelector) {
  const target = norm(wanted);
  const textOf = (anchor) => {
    const label = labelSelector ? anchor.querySelector(labelSelector) : null;
    return norm(elementText(label || anchor));
  };

  return (
    anchors.find((a) => textOf(a) === target) ||
    anchors.find((a) => textOf(a).includes(target)) ||
    anchors.find((a) => target.includes(textOf(a))) ||
    null
  );
}

export function findLinkedRecordByText(recordName, options) {
  const root = options.root || getActiveAppDocument();
  const hrefPattern = options.hrefPattern;
  const labelSelectors = options.labelSelectors || [];

  const links = $$("a[href]", root).filter(
    (anchor) => hrefPattern.test(hrefPath(anchor)) && isVisible(anchor),
  );

  for (const selector of labelSelectors) {
    const byHref = pickAnchorByText(links, recordName, selector);
    if (byHref) return byHref;
  }

  for (const selector of labelSelectors) {
    const labels = $$(selector, root).filter(isVisible);
    const target = findByText(labels, recordName);
    const link = target ? target.closest("a[href]") || target.closest("a") : null;
    if (link && hrefPattern.test(hrefPath(link))) return link;
  }

  return null;
}

function isTransactionHistoryVisible() {
  const root = getActiveAppDocument();

  return Boolean(
    $("[data-test-contact-show-tx-history-row-description]", root) ||
      $("[data-tid='close-tx-history']", root) ||
      $("[class*='show-tx-history']", root),
  );
}

function isTransactionHistoryLoaded() {
  const root = getActiveAppDocument();

  return (
    $$("[data-test-contact-show-tx-history-row-description]", root).some(
      isVisible,
    ) ||
    Boolean($("[class*='pagination-info']", root)) ||
    Boolean($("[data-tid='export-button']", root))
  );
}

function findShowTransactionHistoryButton() {
  const root = getActiveAppDocument();
  const wanted = norm("İŞLEM GEÇMİŞİNİ GÖSTER");

  return (
    $$("button", root)
      .filter(isVisible)
      .find(
        (button) =>
          button.getAttribute("data-tid") === "show-tx-history" ||
          norm(elementText(button)) === wanted,
      ) || null
  );
}

async function ensureTransactionHistoryVisible(clickLink) {
  if (isTransactionHistoryVisible()) return true;

  const opener = findShowTransactionHistoryButton();
  if (!opener) return false;

  clickLink(opener);
  await waitFor(() => isTransactionHistoryLoaded(), 12000);
  await sleep(300);
  return true;
}

function transactionHistoryFingerprint() {
  const root = getActiveAppDocument();

  return $$("[data-test-contact-show-tx-history-row-description]", root)
    .slice(0, 3)
    .map((el) => {
      const link = el.closest("a[href]");
      return `${link?.getAttribute("href") || ""}|${norm(elementText(el))}`;
    })
    .join("||");
}

function isTransactionHistoryPageActive(pageNumber) {
  const expected = String(pageNumber);
  const root = getActiveAppDocument();

  const activeLink = $$("a.active", root).find(
    (anchor) => norm(elementText(anchor)) === expected,
  );
  if (activeLink) return true;

  const view = root.defaultView || window;
  try {
    const url = new URL(view.location.href);
    return url.searchParams.get("islem-gecmisi-sayfa") === expected;
  } catch {
    return false;
  }
}

function findTransactionHistoryPageLink(pageNumber) {
  const expected = String(pageNumber);
  const root = getActiveAppDocument();

  return (
    $$("a[href]", root)
      .filter(isVisible)
      .find((anchor) => {
        const search = hrefSearch(anchor);
        const isPageNumber = norm(elementText(anchor)) === expected;
        const isPaginationLink =
          Boolean(anchor.closest("[class*='page-numbers']")) ||
          Boolean(anchor.closest("[data-test-page]"));

        return (
          search.includes(`islem-gecmisi-sayfa=${expected}`) ||
          (isPageNumber && isPaginationLink)
        );
      }) || null
  );
}

async function goToTransactionHistoryPage(pageNumber, clickLink) {
  if (!isTransactionHistoryVisible()) return false;
  if (isTransactionHistoryPageActive(pageNumber)) return true;

  const link = findTransactionHistoryPageLink(pageNumber);
  if (!link) return false;

  const before = transactionHistoryFingerprint();
  clickLink(link);

  const reachedPage = await waitFor(() => {
    if (isTransactionHistoryPageActive(pageNumber)) return true;
    const after = transactionHistoryFingerprint();
    return Boolean(after && after !== before);
  }, 12000).catch(() => null);

  if (!reachedPage) return false;

  await waitFor(() => isTransactionHistoryLoaded(), 5000).catch(() => null);
  await sleep(300);
  return true;
}

export async function findRecordLinkWithHistory(recordName, options) {
  const findLink = () => findLinkedRecordByText(recordName, options);
  let link = await waitFor(findLink, options.initialTimeout || 9000).catch(
    () => null,
  );

  if (!link) {
    const historyOpened = await ensureTransactionHistoryVisible(options.clickLink);

    if (historyOpened) {
      options.onProgress?.(
        options.historyProgress || `İşlem geçmişinde aranıyor: ${recordName}`,
      );
      link = await waitFor(findLink, options.historyTimeout || 2500).catch(
        () => null,
      );
    }
  }

  if (!link && isTransactionHistoryVisible()) {
    options.onProgress?.(
      options.secondPageProgress ||
        `İşlem geçmişi 2. sayfa kontrol ediliyor: ${recordName}`,
    );

    const movedToSecondPage = await goToTransactionHistoryPage(
      2,
      options.clickLink,
    );

    if (movedToSecondPage) {
      link = await waitFor(findLink, options.secondPageTimeout || 3000).catch(
        () => null,
      );
    }
  }

  return link;
}
