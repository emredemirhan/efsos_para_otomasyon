import { formatAmountTR, formatDateTR } from "../core/format.js";
import { elementText, norm } from "../core/text.js";
import {
  $,
  $$,
  getVisibleDropdownRoots,
  getActiveAppDocument,
  isVisible,
  sendKey,
  setNativeValue,
  sleep,
  waitFor,
} from "./dom.js";
import { selectCategory } from "./dropdowns.js";
import { findInputByLabels, setRequiredField } from "./fields.js";
import { getSalaryStage } from "./pageDetection.js";

const RECORD_NAME_LABELS = ["KAYIT İSMİ", "KAYIT ADI", "AÇIKLAMA"];
const ENTITLEMENT_DATE_LABELS = ["HAK EDİŞ TARİHİ", "HAKEDİŞ TARİHİ"];
const DUE_DATE_LABELS = ["ÖDENECEĞİ TARİH", "ÖDEME TARİHİ", "VADE TARİHİ"];
const AMOUNT_LABELS = ["TOPLAM TUTAR", "GENEL TOPLAM", "TUTAR"];
const SALARY_PAYMENT_FORM_SELECTOR =
  "[class*='salary'][class*='payment-widget'], [class*='payment-widget-cash']";

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

function nativeClick(el) {
  if (!el) return;

  const view = el.ownerDocument?.defaultView || window;
  const opts = { bubbles: true, cancelable: true, view, button: 0 };

  try {
    el.dispatchEvent(new view.MouseEvent("mousedown", opts));
    el.dispatchEvent(new view.MouseEvent("mouseup", opts));
  } catch {}

  el.click();
}

function describeElement(el) {
  if (!el) return null;

  return {
    tag: el.tagName,
    id: el.id || "",
    className: String(el.className || ""),
    text: elementText(el).slice(0, 120),
    type: el.getAttribute?.("type") || "",
  };
}

function isSalaryPaymentSaveControl(target, form) {
  const control = target?.closest?.("button, input[type='submit'], a");
  if (!control || !form.contains(control)) return false;

  const text = norm(elementText(control) || control.value || "");
  return text === "ÖDEME EKLE";
}

function installSalaryPaymentSubmitGuard(form) {
  const doc = form.ownerDocument || document;

  const logClick = (event) => {
    const control = event.target?.closest?.("a, button, input");
    if (!control || !form.contains(control)) return;

    console.info("[AJANS][salary-payment-click]", {
      control: describeElement(control),
      defaultPrevented: event.defaultPrevented,
    });
  };

  const blockSubmit = (event) => {
    if (event.target === form || form.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("[AJANS] Maaş ödeme otomasyonu kaydetme işlemini engelledi.");
    }
  };

  const blockSaveClick = (event) => {
    if (!isSalaryPaymentSaveControl(event.target, form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    console.warn("[AJANS] Otomasyon son ÖDEME EKLE butonuna basmadı.");
  };

  doc.addEventListener("click", logClick, true);
  doc.addEventListener("submit", blockSubmit, true);
  doc.addEventListener("click", blockSaveClick, true);

  return () => {
    doc.removeEventListener("click", logClick, true);
    doc.removeEventListener("submit", blockSubmit, true);
    doc.removeEventListener("click", blockSaveClick, true);
  };
}

async function withSalaryPaymentSubmitGuard(form, action) {
  const releaseGuard = installSalaryPaymentSubmitGuard(form);

  try {
    const result = await action();
    await sleep(800);
    return result;
  } finally {
    releaseGuard();
  }
}

function getSearchRoots() {
  const roots = [getActiveAppDocument(), document];

  try {
    if (window.top?.document) roots.push(window.top.document);
  } catch {}

  return roots.filter((root, index) => root && roots.indexOf(root) === index);
}

function getEmployeeHeaderName() {
  const root = getActiveAppDocument();
  const el =
    $("[data-test-contact-show-header-name]", root) ||
    $("[data-test-display-name]", root);

  return el ? elementText(el) : "";
}

function getEmployeesSearchInput() {
  const root = getActiveAppDocument();
  return (
    $("[data-test-search-box] input", root) ||
    $$("input[placeholder='Ara...']", root).find(isVisible) ||
    null
  );
}

function findEmployeesNavLink() {
  const roots = [getActiveAppDocument(), document];
  try {
    if (window.top && window.top.document) roots.push(window.top.document);
  } catch {}

  for (const root of roots) {
    let link = null;
    try {
      link = $$("a[href*='/calisanlar']", root).find((anchor) => {
        const href = (anchor.getAttribute("href") || "").split("#")[0];
        return /\/calisanlar(?:\?|$)/.test(href);
      });
    } catch {
      link = null;
    }
    if (link) return link;
  }

  return null;
}

async function goToEmployeesList() {
  const isReady = () =>
    getSalaryStage() === "employees" && Boolean(getEmployeesSearchInput());

  if (isReady()) return;

  for (let attempt = 0; attempt < 4; attempt++) {
    const navLink = findEmployeesNavLink();
    if (navLink) clickLink(navLink);

    const reached = await waitFor(isReady, 4000).catch(() => null);
    if (reached) return;
  }

  throw new Error("Çalışanlar sayfasına gidilemedi.");
}

function findEmployeeRowLink(employeeName) {
  const root = getActiveAppDocument();

  const detailLinks = $$("a[href]", root).filter(
    (a) => /\/calisanlar\/\d+/.test(hrefPath(a)) && isVisible(a),
  );
  const byHref = pickAnchorByText(
    detailLinks,
    employeeName,
    "[data-test-display-name]",
  );
  if (byHref) return byHref;

  const names = $$("[data-test-display-name]", root).filter(isVisible);
  const target = findByText(names, employeeName);
  return target ? target.closest("a[href]") || target.closest("a") : null;
}

async function searchAndOpenEmployee(employeeName) {
  const search = await waitFor(() => getEmployeesSearchInput(), 8000);

  setNativeValue(search, employeeName, { blur: false });
  await sleep(400);
  search.focus();
  sendKey(search, "Enter");

  const link = await waitFor(() => findEmployeeRowLink(employeeName), 9000).catch(
    () => null,
  );

  if (!link) throw new Error(`Çalışan bulunamadı: ${employeeName}`);

  clickLink(link);
  await waitFor(
    () =>
      getSalaryStage() === "employee-detail" ||
      Boolean(findMoreMenuTrigger()) ||
      textMatches(getEmployeeHeaderName(), employeeName),
    12000,
  );
  await waitFor(
    () => textMatches(getEmployeeHeaderName(), employeeName),
    1500,
  ).catch(() => null);
}

function findVisibleActionContaining(text, options = {}) {
  const wanted = norm(text);
  const selector = options.selector || "button, a";
  const roots = options.roots || [options.root || getActiveAppDocument()];

  for (const root of roots) {
    const found = $$(selector, root)
      .filter(isVisible)
      .find((el) => norm(elementText(el)).includes(wanted));

    if (found) return found;
  }

  return null;
}

function findSalaryPaymentWidget() {
  const root = getActiveAppDocument();
  const candidates = $$(SALARY_PAYMENT_FORM_SELECTOR, root).filter(isVisible);

  return (
    candidates.find((el) => norm(elementText(el)).includes("ÖDEME EKLE")) ||
    candidates[0] ||
    null
  );
}

function findSalaryPaymentOpenerButton() {
  const root = getActiveAppDocument();
  const wanted = norm("ÖDEME EKLE");

  return $$("button, a", root)
    .filter(isVisible)
    .find((button) => {
      if (button.closest(SALARY_PAYMENT_FORM_SELECTOR)) return false;
      return norm(elementText(button)) === wanted;
    });
}

async function openSalaryPaymentForm() {
  if (findSalaryPaymentWidget()) return;

  const opener = findSalaryPaymentOpenerButton();
  if (!opener) throw new Error("'Ödeme Ekle' butonu bulunamadı.");

  nativeClick(opener);
  await waitFor(() => findSalaryPaymentWidget(), 8000);
  await sleep(300);
}

function findSalaryPaymentFieldByLabel(form, labelTexts) {
  const wanted = labelTexts.map(norm);

  return (
    $$("[class*='p-field']", form).find((field) => {
      const label = field.querySelector("label, [class*='field-label']");
      const text = norm(elementText(label));
      return wanted.some((want) => text.includes(want));
    }) || null
  );
}

async function setSalaryPaymentDate(form, date) {
  const field = findSalaryPaymentFieldByLabel(form, ["TARİH"]);
  if (!field) throw new Error("Maaş ödeme TARİH alanı bulunamadı.");

  const input = field.querySelector("input[type='text'], input");
  if (!input) throw new Error("Maaş ödeme TARİH input'u bulunamadı.");

  setNativeValue(input, formatDateTR(date), { blur: false, keyup: false });
  await sleep(200);
}

async function selectSalaryPaymentAccount(form, account) {
  const field = findSalaryPaymentFieldByLabel(form, ["HESAP"]);
  if (!field) throw new Error("Maaş ödeme HESAP alanı bulunamadı.");

  const trigger =
    field.querySelector(".ember-power-select-trigger, [role='button'][data-ebd-id]") ||
    field.querySelector("[role='button']") ||
    field;
  const wanted = norm(account);

  nativeClick(trigger);
  await sleep(250);

  const option = await waitFor(() => {
    const roots = getSearchRoots().flatMap((root) => getVisibleDropdownRoots(root));

    for (const root of roots) {
      const options = $$(
        ".ember-power-select-option, [role='option'], li, a, button",
        root,
      ).filter(isVisible);

      const match =
        options.find((item) => norm(elementText(item)) === wanted) ||
        options.find((item) => norm(elementText(item)).includes(wanted)) ||
        options.find((item) => wanted.includes(norm(elementText(item))));

      if (match) return match;
    }

    nativeClick(trigger);
    return null;
  }, 7000).catch(() => null);

  if (!option) throw new Error(`Maaş ödeme hesabı bulunamadı: ${account}`);

  nativeClick(option);
  await sleep(300);
}

function setSalaryPaymentAmount(form, amount) {
  const field = findSalaryPaymentFieldByLabel(form, ["MEBLAĞ", "MEBLAG"]);
  if (!field) throw new Error("Maaş ödeme MEBLAĞ alanı bulunamadı.");

  const input = field.querySelector("input[datatype='decimal2'], input");
  if (!input) throw new Error("Maaş ödeme MEBLAĞ input'u bulunamadı.");

  setNativeValue(input, formatAmountTR(amount), { blur: false, keyup: false });
}

function setSalaryPaymentDescription(form, description) {
  if (!description) return;

  const field = findSalaryPaymentFieldByLabel(form, ["AÇIKLAMA", "ACIKLAMA"]);
  if (!field) {
    console.warn("[AJANS] Maaş ödeme AÇIKLAMA alanı bulunamadı.");
    return;
  }

  const input = field.querySelector("input[type='text'], input");
  if (input) setNativeValue(input, description, { blur: false, keyup: false });
}

async function fillSalaryPaymentForm(record) {
  const form = await waitFor(() => findSalaryPaymentWidget(), 8000);

  await withSalaryPaymentSubmitGuard(form, async () => {
    await setSalaryPaymentDate(form, record.date);
    await selectSalaryPaymentAccount(form, record.account);
    setSalaryPaymentAmount(form, record.amount);
    setSalaryPaymentDescription(form, record.description || record.salaryTitle);
  });
}

export function isSalaryPaymentFormOpen() {
  return Boolean(findSalaryPaymentWidget());
}

function findEmployeeSidebar(root = getActiveAppDocument()) {
  const explicit = $$("[class*='employee'][class*='show-sidebar']", root).find(
    isVisible,
  );
  if (explicit) return explicit;

  const balance =
    $("[data-test-employee-show-balance]", root) ||
    $("[data-test-balance-info]", root);

  return balance?.closest?.("[class*='show-sidebar']") || balance?.parentElement;
}

function findMoreMenuTrigger() {
  for (const root of getSearchRoots()) {
    const sidebar = findEmployeeSidebar(root);
    const scopes = [sidebar, root].filter(Boolean);

    for (const scope of scopes) {
      const dropdownTrigger = $$(
        ".ember-basic-dropdown-trigger, [role='button'][data-ebd-id]",
        scope,
      )
        .filter(isVisible)
        .find((el) => norm(elementText(el)).includes("DİĞER"));

      if (dropdownTrigger) return dropdownTrigger;

      const button = $$("button", scope)
        .filter(isVisible)
        .find((el) => norm(elementText(el)).includes("DİĞER"));

      if (button) return button.closest(".ember-basic-dropdown-trigger") || button;
    }
  }

  return null;
}

function findSalaryMenuAction() {
  const roots = getSearchRoots();

  for (const root of roots) {
    const dropdownRoots = getVisibleDropdownRoots(root);
    const action = findVisibleActionContaining("YENİ MAAŞ / PRİM OLUŞTUR", {
      roots: dropdownRoots,
      selector: "a, button, li",
    });

    if (action) {
      return action.matches("a, button")
        ? action
        : action.querySelector("a, button");
    }
  }

  return findVisibleActionContaining("YENİ MAAŞ / PRİM OLUŞTUR", {
    roots,
    selector: "a, button",
  });
}

async function openSalaryCreateForm() {
  if (getSalaryStage() === "salary-form") return;

  const moreButton = await waitFor(
    () => findMoreMenuTrigger(),
    8000,
  ).catch(() => null);

  if (!moreButton) throw new Error("'Diğer' butonu bulunamadı.");

  for (let attempt = 0; attempt < 3; attempt++) {
    nativeClick(moreButton);

    const salaryAction = await waitFor(() => findSalaryMenuAction(), 2500).catch(
      () => null,
    );

    if (salaryAction) {
      clickLink(salaryAction);
      await waitFor(() => getSalaryStage() === "salary-form", 12000);
      await sleep(500);
      return;
    }

    await sleep(300);
  }

  throw new Error("'Yeni Maaş / Prim Oluştur' seçeneği bulunamadı.");
}

async function waitForSalaryFormReady() {
  return waitFor(
    () => findInputByLabels(RECORD_NAME_LABELS, getActiveAppDocument()),
    15000,
  ).catch(() => null);
}

async function setSalaryDate(labelTexts, date, fieldName) {
  const input = findInputByLabels(labelTexts, getActiveAppDocument());

  if (!input) {
    throw new Error(`${fieldName} alanı bulunamadı.`);
  }

  setNativeValue(input, formatDateTR(date));
  await sleep(150);
}

async function fillSalaryExpenseForm(record) {
  if (!record.employee) throw new Error("Çalışan adı boş.");
  if (!record.title) throw new Error("Kayıt ismi boş.");
  if (!record.amount) throw new Error("Toplam tutar boş.");
  if (!record.entitlementDateText) throw new Error("Hak ediş tarihi boş.");
  if (!record.dueDateText) throw new Error("Ödeneceği tarih boş.");

  const ready = await waitForSalaryFormReady();
  if (!ready) {
    throw new Error("Yeni Maaş / Prim formu yüklenmedi; Kayıt İsmi alanı bulunamadı.");
  }

  setRequiredField(RECORD_NAME_LABELS, record.title, "Kayıt ismi");

  await setSalaryDate(
    ENTITLEMENT_DATE_LABELS,
    record.entitlementDate,
    "Hak ediş tarihi",
  );

  setRequiredField(
    AMOUNT_LABELS,
    formatAmountTR(record.amount),
    "Toplam tutar",
  );

  await setSalaryDate(DUE_DATE_LABELS, record.dueDate, "Ödeneceği tarih");
  await selectCategory(record.category || "maaş");
}

export async function runSalaryExpense(record, onProgress = () => {}) {
  if (!record) throw new Error("Maaş kaydı yok.");

  onProgress("Çalışanlar listesine gidiliyor...");
  await goToEmployeesList();

  onProgress(`Çalışan açılıyor: ${record.employee}`);
  await searchAndOpenEmployee(record.employee);

  onProgress("Yeni maaş / prim formu açılıyor...");
  await openSalaryCreateForm();

  onProgress("Maaş gideri alanları dolduruluyor...");
  await fillSalaryExpenseForm(record);
}

export async function runSalaryPayment(record, onProgress = () => {}) {
  if (!record) throw new Error("Maaş ödeme kaydı yok.");
  if (!record.amount) throw new Error("Maaş ödeme tutarı boş.");
  if (!record.date) throw new Error("Maaş ödeme tarihi boş.");
  if (!record.account) throw new Error("Maaş ödeme hesabı boş.");

  onProgress("Maaş ödeme formu açılıyor...");
  await openSalaryPaymentForm();

  onProgress("Maaş ödeme alanları dolduruluyor...");
  await fillSalaryPaymentForm(record);
}
