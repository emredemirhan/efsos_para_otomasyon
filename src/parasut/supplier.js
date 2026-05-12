import { elementText, norm } from "../core/text.js";
import { $$, isVisible, sendKey, setNativeValue, sleep, waitFor } from "./dom.js";
import { findInputByLabels } from "./fields.js";

const SUPPLIER_SEARCH_MIN_WAIT_MS = 1100;

export async function fillSupplier(name) {
  if (!name) return;

  const input = findInputByLabels(["TEDARİKÇİ", "KİŞİ", "CARİ", "FİRMA"]);
  if (!input) throw new Error("Tedarikçi alanı bulunamadı.");

  setNativeValue(input, name, { blur: false });
  await sleep(SUPPLIER_SEARCH_MIN_WAIT_MS);

  const firstOption = await waitFor(() => {
    const options = $$(
      ".ember-power-select-option, .tt-suggestion, [data-test-option], .autocomplete-result, [role='option'], li a",
      input.ownerDocument,
    ).filter(isVisible);

    const wanted = norm(name);
    const exact = options.find((option) => norm(elementText(option)) === wanted);
    const partial = options.find((option) =>
      norm(elementText(option)).includes(wanted),
    );

    return exact || partial || options[0] || null;
  }, 3500).catch(() => null);

  if (!firstOption) {
    throw new Error(`Tedarikçi seçeneği bulunamadı: ${name}`);
  }

  input.focus();
  sendKey(input, "Enter");
  await sleep(500);
}
