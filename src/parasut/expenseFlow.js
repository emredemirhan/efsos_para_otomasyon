import { formatAmountTR, formatDateTR } from "../core/format.js";
import { $, $$, getActiveAppDocument } from "./dom.js";
import { selectCategory, selectTag } from "./dropdowns.js";
import { setOptionalField, setRequiredField } from "./fields.js";
import { isExpenseFormPage } from "./pageDetection.js";
import { fillSupplier } from "./supplier.js";
import { elementText, norm } from "../core/text.js";

function selectUnpaid() {
  const root = getActiveAppDocument();
  const unpaidRadio =
    $("input[name='paymentStatus'][value='unpaid']", root) ||
    $$("label", root)
      .find((label) => norm(elementText(label)).includes("ÖDENECEK"))
      ?.querySelector("input[type='radio']");

  if (unpaidRadio && !unpaidRadio.checked) {
    unpaidRadio.click();
    unpaidRadio.dispatchEvent(new Event("change", { bubbles: true }));
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

  setRequiredField(
    ["FİŞ/FATURA TARİHİ", "FATURA TARİHİ", "FİŞ TARİHİ", "TARİH"],
    formatDateTR(row.issueDate),
    "Fiş/Fatura tarihi",
  );
  setRequiredField(
    ["TOPLAM TUTAR", "GENEL TOPLAM", "TUTAR"],
    formatAmountTR(row.amount),
    "Toplam tutar",
  );
  setOptionalField(["TOPLAM KDV", "KDV"], "0,00");

  selectUnpaid();

  setOptionalField(
    ["ÖDENECEĞİ TARİH", "ÖDEME TARİHİ", "VADE TARİHİ"],
    formatDateTR(row.dueDate),
  );

  await selectCategory(row.brand);

  if (row.tag) {
    await selectTag(row.tag);
  }
}
