import { elementText, norm } from "../core/text.js";
import {
  $$,
  getVisibleDropdownRoots,
  isVisible,
  setNativeValue,
  sleep,
  waitFor,
} from "./dom.js";
import { findSectionByHeadings } from "./fields.js";

export async function selectFromDropdown(sectionNames, value, type) {
  if (!value) return;

  const labels = Array.isArray(sectionNames) ? sectionNames : [sectionNames];
  const section = findSectionByHeadings(labels);
  const displayName = labels[0];

  if (!section) throw new Error(`${displayName} alanı bulunamadı.`);

  const trigger = $$(
    "button, [role='button'], .ember-basic-dropdown-trigger, .ember-power-select-trigger",
    section,
  ).find(isVisible);

  if (!trigger) throw new Error(`${displayName} açma butonu bulunamadı.`);

  trigger.click();
  await sleep(400);

  const searchInput = await waitFor(() => {
    const roots = getVisibleDropdownRoots();

    for (const root of roots) {
      const input = $$(
        "input[placeholder*='Ara'], input[placeholder*='Etiket'], input[name='category_search_field'], input[name='tag_search_field'], .bootstrap-tagsinput input",
        root,
      ).find(isVisible);

      if (input) return input;
    }

    return null;
  }, 4000).catch(() => null);

  if (searchInput) {
    setNativeValue(searchInput, value);
    await sleep(800);
  }

  const candidates = [];

  for (const root of getVisibleDropdownRoots()) {
    candidates.push(
      ...$$(
        "[data-tid='select-category'], [data-tid='toggleTag'], .ember-power-select-option, li a, a, button",
        root,
      ).filter(isVisible),
    );
  }

  const exact = candidates.find((el) => {
    const title =
      el.querySelector("[title]")?.getAttribute("title") ||
      el.getAttribute("title") ||
      elementText(el);

    return norm(title) === norm(value);
  });

  const partial = candidates.find((el) => {
    const title =
      el.querySelector("[title]")?.getAttribute("title") ||
      el.getAttribute("title") ||
      elementText(el);

    return norm(title).includes(norm(value));
  });

  const selected = exact || partial;

  if (!selected) {
    throw new Error(`${type} bulunamadı: ${value}`);
  }

  selected.click();
  await sleep(500);
}

export async function selectCategory(name) {
  await selectFromDropdown(
    ["GİDER KATEGORİSİ", "KATEGORİ", "HARCAMA KATEGORİSİ"],
    name,
    "Kategori",
  );
}

export async function selectTag(name) {
  await selectFromDropdown(["ETİKETLER", "ETİKET"], name, "Etiket");
}
