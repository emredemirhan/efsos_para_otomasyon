import { formatAmountTR, formatDateTR } from "../core/format.js";
import { $, $$, getActiveAppDocument, sleep, waitFor } from "./dom.js";
import { selectCategory, selectTag } from "./dropdowns.js";
import { setOptionalField, setRequiredField } from "./fields.js";
import { findCalendarByLabels, setDateFieldByLabels } from "./datepicker.js";
import { isExpenseFormPage } from "./pageDetection.js";
import { fillSupplier } from "./supplier.js";
import { elementText, norm } from "../core/text.js";

const ISSUE_DATE_LABELS = [
  "FİŞ/FATURA TARİHİ",
  "FATURA TARİHİ",
  "FİŞ TARİHİ",
  "TARİH",
];

const DUE_DATE_LABELS = ["ÖDENECEĞİ TARİH", "ÖDEME TARİHİ", "VADE TARİHİ"];

function findUnpaidRadio(root) {
  const direct = $("input[name='paymentStatus'][value='unpaid']", root);
  if (direct) return direct;

  const labels = $$("label", root).filter((label) =>
    norm(elementText(label)).includes("ÖDENECEK"),
  );

  for (const label of labels) {
    const inner = label.querySelector(
      "input[type='radio'], input[type='checkbox']",
    );
    if (inner) return inner;

    if (label.htmlFor) {
      const target = label.ownerDocument.getElementById(label.htmlFor);
      if (target?.matches?.("input")) return target;
    }

    const sibling =
      label.previousElementSibling?.matches?.("input")
        ? label.previousElementSibling
        : label.nextElementSibling?.matches?.("input")
          ? label.nextElementSibling
          : null;
    if (sibling) return sibling;

    const parentRadio = label.parentElement?.querySelector?.(
      "input[type='radio']",
    );
    if (parentRadio) return parentRadio;
  }

  return null;
}

async function selectUnpaidAndWaitDueDate() {
  const root = getActiveAppDocument();
  const unpaidRadio = findUnpaidRadio(root);

  if (unpaidRadio) {
    if (!unpaidRadio.checked) {
      unpaidRadio.click();
      unpaidRadio.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(300);
    }
  } else {
    console.warn(
      "[AJANS] 'Ödenecek' radio bulunamadı, ödeneceği tarih alanı zaten açık olabilir.",
    );
  }

  return waitFor(() => findCalendarByLabels(DUE_DATE_LABELS), 4000).catch(
    () => null,
  );
}

async function setIssueDate(date) {
  const ok = await setDateFieldByLabels(ISSUE_DATE_LABELS, date);
  if (!ok) {
    throw new Error(
      `Fiş/Fatura tarihi doldurulamadı: ${formatDateTR(date)}`,
    );
  }
}

async function setDueDate(date) {
  const ok = await setDateFieldByLabels(DUE_DATE_LABELS, date);

  if (!ok) {
    console.warn(
      "[AJANS] Ödeneceği tarih takvimi doldurulamadı:",
      formatDateTR(date),
    );
  }
}

export async function fillExpense(row) {
  if (!isExpenseFormPage()) {
    throw new Error(
      "Şu an gider formunda değilsin. Yeni gider formunu açıp tekrar dene.",
    );
  }

  if (!row.amount) throw new Error("Toplam tutar boş.");
  if (!row.supplier) throw new Error("KİŞİ / tedarikçi boş.");
  if (!row.brand) throw new Error("MARKA / gider kategorisi boş.");

  const title = row.title || `${row.brand} gider`;

  setRequiredField(
    ["KAYIT İSMİ", "FİŞ/FATURA ADI", "FATURA ADI", "AÇIKLAMA"],
    title,
    "Kayıt ismi",
  );
  await fillSupplier(row.supplier);

  await setIssueDate(row.issueDate);

  setRequiredField(
    ["TOPLAM TUTAR", "GENEL TOPLAM", "TUTAR"],
    formatAmountTR(row.amount),
    "Toplam tutar",
  );
  setOptionalField(["TOPLAM KDV", "KDV"], "0,00");

  await selectUnpaidAndWaitDueDate();
  await setDueDate(row.dueDate);

  await selectCategory(row.brand);

  if (row.tag) {
    await selectTag(row.tag);
  }
}
