import { formatDateTR } from "../core/format.js";
import { elementText, norm } from "../core/text.js";
import {
  $$,
  getActiveAppDocument,
  isVisible,
  setNativeValue,
  sleep,
  waitFor,
} from "./dom.js";

const DUE_DATE_SHORTCUT_HINTS = [
  "BİLİNMİYOR",
  "AY BAŞINDA",
  "1 HAFTA SONRA",
  "2 HAFTA SONRA",
  "1 AY SONRA",
  "2 AY SONRA",
];

function hasDueDateShortcuts(container) {
  const buttons = $$("button", container);
  if (!buttons.length) return false;

  const texts = buttons.map((btn) => norm(elementText(btn)));
  return DUE_DATE_SHORTCUT_HINTS.some((hint) =>
    texts.some((text) => text.includes(hint)),
  );
}

function findDatePickerNearLabel(label) {
  let node = label;

  for (let i = 0; i < 12 && node; i++) {
    if (node.querySelector) {
      const pickers = $$('[class*="__p-date-picker__"]', node).filter(isVisible);
      if (pickers.length === 1) return pickers[0];
      if (pickers.length > 1) {
        const withShortcuts = pickers.find(hasDueDateShortcuts);
        return withShortcuts || pickers[0];
      }
    }
    node = node.parentElement;
  }

  node = label;
  for (let i = 0; i < 12 && node; i++) {
    if (node.querySelector) {
      const calendars = $$(".calendar-container", node).filter(isVisible);
      if (calendars.length) {
        const target = calendars.find(hasDueDateShortcuts) || calendars[0];
        return target.closest('[class*="__p-date-picker__"]') || target;
      }
    }
    node = node.parentElement;
  }

  return null;
}

function searchLabelsByTags(tagSelector, wantedLabels, root) {
  const elements = $$(tagSelector, root);
  return wantedLabels.flatMap((wanted) =>
    elements.filter((el) => norm(elementText(el)).includes(wanted)),
  );
}

export function findCalendarByLabels(labelTexts, root = getActiveAppDocument()) {
  const wantedLabels = labelTexts.map(norm);

  for (const selector of ["label", "h4, h3, strong, legend"]) {
    const matches = searchLabelsByTags(selector, wantedLabels, root);
    matches.sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));

    for (const label of matches) {
      const picker = findDatePickerNearLabel(label);
      if (picker) return picker;
    }
  }

  const visiblePickers = $$('[class*="__p-date-picker__"]', root).filter(isVisible);
  const dueDateInline = visiblePickers.find(hasDueDateShortcuts);
  if (dueDateInline) return dueDateInline;

  return null;
}

function findVisibleInput(picker) {
  if (!picker) return null;
  return (
    $$("input", picker).find(
      (el) => (el.type === "text" || !el.type) && isVisible(el),
    ) || null
  );
}

function findInlinePikaSingle(picker) {
  if (!picker) return null;
  const all = $$(".pika-single", picker);
  return (
    all.find((el) => !el.classList.contains("is-bound") && isVisible(el)) ||
    all.find((el) => !el.classList.contains("is-bound")) ||
    null
  );
}

function findVisibleBoundPikaSingle(doc) {
  const scope = doc?.body || doc || getActiveAppDocument();
  const all = $$(".pika-single.is-bound", scope);
  return (
    all.find((el) => !el.classList.contains("is-hidden") && isVisible(el)) ||
    null
  );
}

function setSelectValue(select, value) {
  if (!select) return false;
  if (Number(select.value) === Number(value)) return false;

  const view = select.ownerDocument?.defaultView || window;
  const setter = Object.getOwnPropertyDescriptor(
    view.HTMLSelectElement.prototype,
    "value",
  )?.set;

  if (setter) setter.call(select, String(value));
  else select.value = String(value);

  select.dispatchEvent(new view.Event("change", { bubbles: true }));
  return true;
}

export async function setPikadayDate(pikaSingle, date) {
  if (!pikaSingle) return false;

  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();

  const yearSelect = pikaSingle.querySelector("select.pika-select-year");
  const monthSelect = pikaSingle.querySelector("select.pika-select-month");

  const yearChanged = setSelectValue(yearSelect, targetYear);
  const monthChanged = setSelectValue(monthSelect, targetMonth);

  if (yearChanged || monthChanged) await sleep(350);

  const selector =
    `button.pika-day[data-pika-year='${targetYear}']` +
    `[data-pika-month='${targetMonth}']` +
    `[data-pika-day='${targetDay}']`;

  const dayButton = await waitFor(
    () => pikaSingle.querySelector(selector),
    2500,
  ).catch(() => null);

  if (!dayButton) {
    console.warn(
      "[AJANS] Pikaday gün butonu bulunamadı:",
      formatDateTR(date),
      "container:",
      pikaSingle,
    );
    return false;
  }

  dayButton.click();
  await sleep(250);
  return true;
}

export async function setLegacyPikadayDate(pikaSingle, date) {
  if (!pikaSingle || !date) return false;

  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();

  const yearSelect = pikaSingle.querySelector("select.pika-select-year");
  const monthSelect = pikaSingle.querySelector("select.pika-select-month");

  const yearChanged = setSelectValue(yearSelect, targetYear);
  const monthChanged = setSelectValue(monthSelect, targetMonth);

  if (yearChanged || monthChanged) await sleep(350);

  const dayButton = await waitFor(() => {
    const cell = $$("td[data-day]", pikaSingle).find(
      (td) =>
        !td.classList.contains("is-empty") &&
        Number(td.getAttribute("data-day")) === targetDay &&
        td.querySelector("button.pika-button"),
    );

    return cell ? cell.querySelector("button.pika-button") : null;
  }, 2500).catch(() => null);

  if (!dayButton) {
    console.warn(
      "[AJANS] Eski pikaday gün butonu bulunamadı:",
      formatDateTR(date),
    );
    return false;
  }

  dayButton.click();
  await sleep(250);
  return true;
}

async function openBoundPikaday(input) {
  if (!input) return null;

  const view = input.ownerDocument?.defaultView || window;
  const doc = input.ownerDocument || document;

  try {
    input.focus();
  } catch {}

  input.dispatchEvent(new view.MouseEvent("mousedown", { bubbles: true }));
  input.dispatchEvent(new view.MouseEvent("mouseup", { bubbles: true }));

  try {
    input.click();
  } catch {}

  return waitFor(() => findVisibleBoundPikaSingle(doc), 2500).catch(() => null);
}

async function closeBoundPikaday(input) {
  if (!input) return;

  try {
    input.blur();
  } catch {}

  const doc = input.ownerDocument || document;
  const view = doc.defaultView || window;
  doc.body?.dispatchEvent(
    new view.MouseEvent("mousedown", { bubbles: true }),
  );
  await sleep(150);
}

export async function setDateFieldByLabels(labelTexts, date) {
  if (!date) return false;

  const root = getActiveAppDocument();
  const picker = await waitFor(
    () => findCalendarByLabels(labelTexts, root),
    3500,
  ).catch(() => null);

  if (!picker) {
    console.warn(
      "[AJANS] Tarih alanı bulunamadı. Aranan label'lar:",
      labelTexts,
    );
    return false;
  }

  const inline = findInlinePikaSingle(picker);
  if (inline) {
    if (await setPikadayDate(inline, date)) return true;
  }

  const input = findVisibleInput(picker);
  if (input) {
    const bound = await openBoundPikaday(input);
    if (bound) {
      const ok = await setPikadayDate(bound, date);
      await closeBoundPikaday(input);
      if (ok) return true;
    }
  }

  const hiddenInput = picker.querySelector("input.ember-pikaday-input");
  if (hiddenInput) {
    console.info(
      "[AJANS] Pikaday popup açılamadı, hidden input fallback denenecek.",
    );
    setNativeValue(hiddenInput, formatDateTR(date));
    return true;
  }

  console.warn(
    "[AJANS] Tarih takvimi doldurulamadı:",
    formatDateTR(date),
    "label:",
    labelTexts,
  );
  return false;
}
