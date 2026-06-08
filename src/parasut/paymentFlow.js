import { formatAmountTR, formatDateTR } from "../core/format.js";
import { elementText, norm } from "../core/text.js";
import {
  $,
  $$,
  clickWithoutDefaultNavigation,
  getActiveAppDocument,
  isVisible,
  sendKey,
  setNativeValue,
  sleep,
  waitFor,
} from "./dom.js";
import { setLegacyPikadayDate } from "./datepicker.js";
import { getPaymentStage } from "./pageDetection.js";

function textMatches(candidate, wanted) {
  const a = norm(candidate);
  const b = norm(wanted);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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

function hrefPath(anchor) {
  return (anchor.getAttribute("href") || "").split("#")[0].split("?")[0];
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

// Paraşüt eski bir Ember uygulaması; link tıklamalarını jQuery delegasyonuyla
// dinleyip route geçişi yapıyor. Native dispatchEvent bu handler'ı tetiklemediği
// için önce sayfanın jQuery'siyle tıklıyoruz (manuel tıklamayla aynı yol).
function clickLink(el) {
  if (!el) return;
  const view = el.ownerDocument?.defaultView || window;
  const jq = (view.Ember && view.Ember.$) || view.jQuery || view.$;

  if (jq) {
    try {
      jq(el).trigger("click");
      return;
    } catch (err) {
      console.warn("[AJANS] jQuery tıklaması başarısız, native'e düşülüyor:", err);
    }
  }

  const opts = { bubbles: true, cancelable: true, view, button: 0 };
  try {
    el.dispatchEvent(new view.MouseEvent("mousedown", opts));
    el.dispatchEvent(new view.MouseEvent("mouseup", opts));
  } catch {}
  el.click();
}

function getSupplierHeaderName() {
  const el = $("[data-test-contact-show-header-name]", getActiveAppDocument());
  return el ? elementText(el) : "";
}

function getBillContactLink() {
  return $("a[data-tid='contact']", getActiveAppDocument());
}

function getBillTitle() {
  const show = $("[data-tns='purchase-bills-show']", getActiveAppDocument());
  const heading = show ? show.querySelector("h1") : null;
  return heading ? elementText(heading) : "";
}

function billMatches(record) {
  if (!textMatches(getBillTitle(), record.itemName)) return false;

  const contact = getBillContactLink();
  if (contact && !textMatches(elementText(contact), record.supplier)) return false;

  return true;
}

function getSuppliersSearchInput() {
  const root = getActiveAppDocument();
  return (
    $("[data-test-search-box] input", root) ||
    $$("input[placeholder='Ara...']", root).find(isVisible) ||
    null
  );
}

async function goToSuppliersList() {
  if (getPaymentStage() === "suppliers" && getSuppliersSearchInput()) return;

  const root = getActiveAppDocument();
  const navLink = $$("a[href*='/tedarikciler']", root).find((anchor) => {
    const href = (anchor.getAttribute("href") || "").split("#")[0];
    return /\/tedarikciler(?:\?|$)/.test(href);
  });

  if (navLink) {
    navLink.click();
  } else {
    const firm = (getActiveAppDocument().location?.pathname || location.pathname).match(
      /^\/(\d+)/,
    );
    if (!firm) throw new Error("Tedarikçiler sayfasına gidilemedi.");
    location.href = `${location.origin}/${firm[1]}/tedarikciler`;
  }

  await waitFor(
    () => getPaymentStage() === "suppliers" && getSuppliersSearchInput(),
    10000,
  );
}

function findSupplierRowLink(supplierName) {
  const root = getActiveAppDocument();

  const detailLinks = $$("a[href]", root).filter(
    (a) => /\/tedarikciler\/\d+/.test(hrefPath(a)) && isVisible(a),
  );
  const byHref = pickAnchorByText(
    detailLinks,
    supplierName,
    "[data-test-display-name]",
  );
  if (byHref) return byHref;

  const names = $$("[data-test-display-name]", root).filter(isVisible);
  const target = findByText(names, supplierName);
  return target ? target.closest("a[href]") || target.closest("a") : null;
}

async function searchAndOpenSupplier(supplierName) {
  const search = await waitFor(() => getSuppliersSearchInput(), 8000);

  setNativeValue(search, supplierName, { blur: false });
  await sleep(400);
  search.focus();
  sendKey(search, "Enter");

  const link = await waitFor(() => findSupplierRowLink(supplierName), 9000).catch(
    () => null,
  );

  if (!link) throw new Error(`Tedarikçi bulunamadı: ${supplierName}`);

  clickLink(link);
  await waitFor(() => getPaymentStage() === "supplier-detail", 12000);
  await waitFor(() => textMatches(getSupplierHeaderName(), supplierName), 8000).catch(
    () => null,
  );
}

async function ensureSupplierDetail(record) {
  const stage = getPaymentStage();

  if (stage === "supplier-detail" && textMatches(getSupplierHeaderName(), record.supplier)) {
    return;
  }

  if (stage === "bill") {
    const contact = getBillContactLink();
    if (contact && textMatches(elementText(contact), record.supplier)) {
      clickLink(contact);
      const reached = await waitFor(
        () => getPaymentStage() === "supplier-detail",
        10000,
      ).catch(() => null);

      if (reached && textMatches(getSupplierHeaderName(), record.supplier)) return;
    }
  }

  await goToSuppliersList();
  await searchAndOpenSupplier(record.supplier);
}

function findExpenseItemLink(itemName) {
  const root = getActiveAppDocument();

  const billLinks = $$("a[href]", root).filter(
    (a) => /\/fis-faturalar\/\d+/.test(hrefPath(a)) && isVisible(a),
  );
  const byHref = pickAnchorByText(billLinks, itemName, "[data-test-description]");
  if (byHref) return byHref;

  const descriptions = $$("[data-test-description]", root).filter(isVisible);
  const target = findByText(descriptions, itemName);
  return target ? target.closest("a[href]") || target.closest("a") : null;
}

async function openExpenseItem(record) {
  const link = await waitFor(() => findExpenseItemLink(record.itemName), 9000).catch(
    () => null,
  );

  if (!link) {
    throw new Error(`Gider kalemi bulunamadı: ${record.itemName}`);
  }

  clickLink(link);
  await waitFor(() => getPaymentStage() === "bill", 12000);
  await waitFor(() => $("[data-tns='purchase-bills-show']", getActiveAppDocument()), 8000);
}

function findPaymentOpenerButton() {
  const wanted = norm("ÖDEME EKLE");

  return $$("button", getActiveAppDocument())
    .filter(isVisible)
    .find((button) => {
      if (button.closest("[data-tns='add-payment']")) return false;
      if (button.closest("form")?.querySelector("[data-tns='add-payment']")) {
        return false;
      }
      if (button.getAttribute("data-tid") === "save") return false;
      return norm(elementText(button)) === wanted;
    });
}

async function openPaymentForm() {
  if ($("[data-tns='add-payment']", getActiveAppDocument())) return;

  const opener = findPaymentOpenerButton();
  if (!opener) throw new Error("'Ödeme Ekle' butonu bulunamadı.");

  opener.click();
  await waitFor(() => $("[data-tns='add-payment']", getActiveAppDocument()), 7000);
  await sleep(300);
}

function findFieldSetByLabel(form, labelTexts) {
  const wanted = labelTexts.map(norm);

  return (
    $$(".fieldSet", form).find((fieldSet) => {
      const label = fieldSet.querySelector(".fieldSet-label");
      const text = norm(elementText(label));
      return wanted.some((want) => text.includes(want));
    }) || null
  );
}

function ensureCashPayment(form) {
  const cashLabel = $$("label", form).find((label) =>
    norm(elementText(label)).includes("NAKİT"),
  );
  const cashRadio =
    (cashLabel && cashLabel.querySelector("input[type='radio']")) ||
    $$("input[name='paymentType']", form)[0];

  if (cashRadio && !cashRadio.checked) {
    cashRadio.click();
    cashRadio.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function describeElement(el) {
  if (!el) return null;

  return {
    tag: el.tagName,
    id: el.id || "",
    className: String(el.className || ""),
    text: elementText(el).slice(0, 120),
    href: el.getAttribute?.("href") || "",
    dataTid: el.getAttribute?.("data-tid") || "",
    type: el.getAttribute?.("type") || "",
  };
}

function urlFromHistoryArgs(view, args) {
  const rawUrl = args[2];
  if (rawUrl === undefined || rawUrl === null || rawUrl === "") return null;

  try {
    return new URL(String(rawUrl), view.location.href);
  } catch {
    return null;
  }
}

function isCompanyRootHashUrl(url) {
  return Boolean(url && /^\/\d+\/?$/.test(url.pathname) && url.hash === "#");
}

function installPaymentNavigationGuard(form) {
  const doc = form.ownerDocument || document;
  const view = doc.defaultView || window;
  const history = view.history;
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  const clickLogger = (event) => {
    const control = event.target?.closest?.("a, button, input");
    if (!control || !form.contains(control)) return;

    console.info("[AJANS][payment-click]", {
      control: describeElement(control),
      defaultPrevented: event.defaultPrevented,
      href: view.location.href,
    });
  };

  const wrapHistory = (methodName, original) => {
    if (typeof original !== "function") return original;

    return function guardedPaymentHistoryMethod(...args) {
      const targetUrl = urlFromHistoryArgs(view, args);

      console.info("[AJANS][payment-history]", {
        methodName,
        from: view.location.href,
        to: targetUrl?.href || "",
      });

      if (isCompanyRootHashUrl(targetUrl)) {
        console.warn("[AJANS] Ödeme otomasyonu root hash yönlendirmesini engelledi.", {
          methodName,
          from: view.location.href,
          to: targetUrl.href,
        });
        return undefined;
      }

      return original.apply(this, args);
    };
  };

  doc.addEventListener("click", clickLogger, true);
  history.pushState = wrapHistory("pushState", originalPushState);
  history.replaceState = wrapHistory("replaceState", originalReplaceState);

  return () => {
    doc.removeEventListener("click", clickLogger, true);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}

function isPaymentSaveControl(target, form) {
  const control = target?.closest?.("button, input[type='submit'], a");
  if (!control || !form.contains(control)) return false;
  if (control.closest(".pika-single, .dropdownContent")) return false;

  const text = norm(elementText(control) || control.value || "");
  return control.getAttribute("data-tid") === "save" || text === "ÖDEME EKLE";
}

function installPaymentSubmitGuard(form) {
  const doc = form.ownerDocument || document;
  const originalSubmit = form.submit;
  const originalRequestSubmit = form.requestSubmit;

  const blockProgrammaticSubmit = () => {
    console.warn("[AJANS] Otomasyon sırasında programatik ödeme kaydetme engellendi.");
  };

  const blockSubmit = (event) => {
    if (event.target === form || form.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("[AJANS] Otomasyon sırasında ödeme kaydetme engellendi.");
    }
  };

  const blockSaveClick = (event) => {
    if (!isPaymentSaveControl(event.target, form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    console.warn("[AJANS] Otomasyon son ÖDEME EKLE butonuna basmadı.");
  };

  doc.addEventListener("submit", blockSubmit, true);
  doc.addEventListener("click", blockSaveClick, true);

  try {
    form.submit = blockProgrammaticSubmit;
    form.requestSubmit = blockProgrammaticSubmit;
  } catch (err) {
    console.warn("[AJANS] Ödeme submit guard form metodlarını saramadı:", err);
  }

  return () => {
    doc.removeEventListener("submit", blockSubmit, true);
    doc.removeEventListener("click", blockSaveClick, true);
    try {
      form.submit = originalSubmit;
      form.requestSubmit = originalRequestSubmit;
    } catch {}
  };
}

async function withPaymentSubmitGuard(form, action) {
  const releaseGuard = installPaymentSubmitGuard(form);
  const releaseNavigationGuard = installPaymentNavigationGuard(form);

  try {
    const result = await action();
    await sleep(1200);
    return result;
  } finally {
    releaseNavigationGuard();
    releaseGuard();
  }
}

async function setPaymentDate(form, date) {
  const fieldSet = findFieldSetByLabel(form, ["TARİH"]);
  if (!fieldSet) {
    console.warn("[AJANS] Ödeme TARİH alanı bulunamadı.");
    return false;
  }

  const input = fieldSet.querySelector("input[type='text'], input.field, input");
  if (input) {
    setNativeValue(input, formatDateTR(date), { blur: false, keyup: false });
    await sleep(250);
    return true;
  }

  const pikaSingle = await waitFor(
    () => fieldSet.querySelector(".pika-single"),
    3000,
  ).catch(() => null);

  if (!pikaSingle) {
    console.warn("[AJANS] Ödeme tarihi takvimi açılamadı.");
    return false;
  }

  return setLegacyPikadayDate(pikaSingle, date);
}

async function selectPaymentAccount(form, account) {
  const fieldSet = findFieldSetByLabel(form, ["HESAP"]);
  if (!fieldSet) throw new Error("HESAP alanı bulunamadı.");

  const dropdown = fieldSet.querySelector(".dropdown") || fieldSet;
  const input = dropdown.querySelector("input");
  const caret = dropdown.querySelector("a[class*='field-innerAppend']");

  if (input) {
    try {
      input.focus();
      input.click();
    } catch {}
  }
  await sleep(250);

  const wanted = norm(account);

  const link = await waitFor(() => {
    const items = $$(".dropdownContent a", dropdown).filter(isVisible);

    if (!items.length) {
      if (caret) caret.click();
      else if (input) input.click();
      return null;
    }

    return (
      items.find((item) => norm(elementText(item)) === wanted) ||
      items.find((item) => norm(elementText(item)).includes(wanted)) ||
      items.find((item) => wanted.includes(norm(elementText(item)))) ||
      null
    );
  }, 6000).catch(() => null);

  if (!link) throw new Error(`Hesap bulunamadı: ${account}`);

  clickWithoutDefaultNavigation(link);
  await sleep(300);
}

function setPaymentAmount(form, amount) {
  const fieldSet = findFieldSetByLabel(form, ["MEBLAĞ", "MEBLAG"]);
  if (!fieldSet) throw new Error("MEBLAĞ alanı bulunamadı.");

  const input =
    fieldSet.querySelector("input.field-number") ||
    fieldSet.querySelector("input.field") ||
    fieldSet.querySelector("input");

  if (!input) throw new Error("MEBLAĞ alanı (input) bulunamadı.");

  setNativeValue(input, formatAmountTR(amount), { blur: false, keyup: false });
}

function setPaymentDescription(form, description) {
  if (!description) return;

  const fieldSet = findFieldSetByLabel(form, ["AÇIKLAMA", "ACIKLAMA"]);
  if (!fieldSet) {
    console.warn("[AJANS] Ödeme AÇIKLAMA alanı bulunamadı.");
    return;
  }

  const input =
    fieldSet.querySelector("input[type='text']") ||
    fieldSet.querySelector("input.field") ||
    fieldSet.querySelector("input");

  if (input) setNativeValue(input, description, { blur: false, keyup: false });
}

async function fillPaymentForm(record) {
  const form = await waitFor(
    () => $("[data-tns='add-payment']", getActiveAppDocument()),
    7000,
  );

  await withPaymentSubmitGuard(form, async () => {
    ensureCashPayment(form);

    if (record.date) {
      await setPaymentDate(form, record.date);
    }

    if (record.account) {
      await selectPaymentAccount(form, record.account);
    }

    setPaymentAmount(form, record.amount);
    setPaymentDescription(form, record.description || record.itemName);
  });
}

export async function runPayment(record, onProgress = () => {}) {
  if (!record) throw new Error("Ödeme kaydı yok.");
  if (!record.supplier) throw new Error("Tedarikçi adı boş.");
  if (!record.itemName) throw new Error("Gider kalemi adı boş.");
  if (!record.amount) throw new Error("Ödeme tutarı boş.");

  const stage = getPaymentStage();

  if (stage === "bill" && billMatches(record)) {
    onProgress("Aynı gider kalemindeyiz, ödeme formu açılıyor...");
    await openPaymentForm();
    await fillPaymentForm(record);
    return;
  }

  onProgress(`Tedarikçi açılıyor: ${record.supplier}`);
  await ensureSupplierDetail(record);

  onProgress(`Gider kalemi açılıyor: ${record.itemName}`);
  await openExpenseItem(record);

  onProgress("Ödeme formu açılıyor...");
  await openPaymentForm();

  onProgress("Ödeme alanları dolduruluyor...");
  await fillPaymentForm(record);
}
