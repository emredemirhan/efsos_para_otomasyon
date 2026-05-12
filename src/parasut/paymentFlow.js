import { formatAmountTR } from "../core/format.js";
import {
  $,
  $$,
  findFillableInput,
  findVisibleActionByText,
  isVisible,
  setNativeValue,
  sleep,
  waitFor,
} from "./dom.js";
import { isPurchaseBillShowPage } from "./pageDetection.js";
import { elementText, norm } from "../core/text.js";

function findPaymentForm() {
  return $$("[data-tns='add-payment']").find(isVisible) || null;
}

function findPaymentFieldInput(fieldNames) {
  const wantedNames = (Array.isArray(fieldNames) ? fieldNames : [fieldNames]).map(
    norm,
  );

  const fieldSet = $$(".fieldSet").find((el) => {
    const label = $(".fieldSet-label", el);
    const labelText = label?.getAttribute("title") || elementText(label);

    return wantedNames.some((wanted) => norm(labelText).includes(wanted));
  });

  if (!fieldSet) return null;

  return findFillableInput($(".fieldSet-value", fieldSet) || fieldSet);
}

async function openPaymentForm() {
  if (findPaymentForm()) return findPaymentForm();

  if (!isPurchaseBillShowPage()) {
    throw new Error(
      "Ödeme eklemek için oluşturulan fiş/fatura detay sayfasında olmalısın.",
    );
  }

  const button = findVisibleActionByText("ÖDEME EKLE", {
    selector: "button",
    excludeSave: true,
  });

  if (!button) throw new Error("Üstteki ÖDEME EKLE butonu bulunamadı.");

  button.click();

  return waitFor(() => findPaymentForm(), 5000);
}

export async function fillPayment(item) {
  if (!item) throw new Error("Ödeme kalemi seçilmedi.");

  await openPaymentForm();

  const amountInput = await waitFor(
    () => findPaymentFieldInput(["MEBLAĞ", "TUTAR"]),
    4000,
  );
  const descriptionInput = findPaymentFieldInput(["AÇIKLAMA"]);

  setNativeValue(amountInput, formatAmountTR(item.amount));

  if (descriptionInput) {
    setNativeValue(descriptionInput, item.description || item.raw || "Ödeme");
  }

  await sleep(300);
}
