import { elementText, norm } from "../core/text.js";
import {
  $$,
  findFillableInput,
  getActiveAppDocument,
  isVisible,
  setNativeValue,
} from "./dom.js";

export function findInputByLabels(labelTexts, root = getActiveAppDocument()) {
  const wantedLabels = labelTexts.map(norm);

  for (const wanted of wantedLabels) {
    const labels = $$("label", root).filter((el) =>
      norm(elementText(el)).includes(wanted),
    );

    labels.sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));

    for (const label of labels) {
      const labelForInput = label.htmlFor
        ? label.ownerDocument.getElementById(label.htmlFor)
        : null;
      if (labelForInput?.matches("input, textarea")) return labelForInput;

      const field =
        label.closest('[class*="__p-field__"]') ||
        label.closest(".field") ||
        label.closest(".fieldGroup") ||
        label.parentElement;

      const fieldInput = findFillableInput(field);
      if (fieldInput) return fieldInput;

      const fieldContentInput =
        findFillableInput(
          label.parentElement?.querySelector('[class*="__p-field-content__"]'),
        ) ||
        findFillableInput(label.nextElementSibling) ||
        findFillableInput(label.parentElement?.nextElementSibling);
      if (fieldContentInput) return fieldContentInput;

      const fieldsetInput = findFillableInput(label.closest("fieldset"));
      if (fieldsetInput) return fieldsetInput;
    }
  }

  return null;
}

export function setRequiredField(labelTexts, value, fieldName) {
  const root = getActiveAppDocument();
  const input = findInputByLabels(labelTexts, root);

  if (!input) {
    console.warn(
      "[AJANS] Alan bulunamadı:",
      fieldName,
      "Aranan label'lar:",
      labelTexts,
      "Sayfadaki label'lar:",
      $$("label", root).map((label) =>
        elementText(label).replace(/\s+/g, " ").trim(),
      ),
    );
    throw new Error(`${fieldName} alanı bulunamadı.`);
  }

  setNativeValue(input, value);
}

export function setOptionalField(labelTexts, value, root = getActiveAppDocument()) {
  const input = findInputByLabels(labelTexts, root);

  if (input) {
    setNativeValue(input, value);
  }
}

export function findSectionByHeadings(headingTexts, root = getActiveAppDocument()) {
  const wantedHeadings = headingTexts.map(norm);

  const heading = $$("h4, h3, label, strong", root).find((el) =>
    wantedHeadings.some((wanted) => norm(elementText(el)).includes(wanted)),
  );

  if (!heading) return null;

  return (
    heading.closest(".inner-container") ||
    heading.closest(".field") ||
    heading.closest(".fieldGroup") ||
    heading.closest("[class*='category']") ||
    heading.closest("[class*='tag']") ||
    heading.parentElement
  );
}
