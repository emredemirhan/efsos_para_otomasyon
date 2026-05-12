import { $$, isVisible, sendKey, setNativeValue, sleep, waitFor } from "./dom.js";
import { findInputByLabels } from "./fields.js";

export async function fillSupplier(name) {
  if (!name) return;

  const input = findInputByLabels(["TEDARİKÇİ", "KİŞİ", "CARİ", "FİRMA"]);
  if (!input) throw new Error("Tedarikçi alanı bulunamadı.");

  setNativeValue(input, name, { blur: false });

  const firstOption = await waitFor(() => {
    const options = $$(
      ".ember-power-select-option, .tt-suggestion, [data-test-option], .autocomplete-result, [role='option'], li a",
      input.ownerDocument,
    ).filter(isVisible);

    return options[0] || null;
  }, 3500).catch(() => null);

  if (!firstOption) {
    throw new Error(`Tedarikçi seçeneği bulunamadı: ${name}`);
  }

  input.focus();
  sendKey(input, "Enter");
  await sleep(500);
}
