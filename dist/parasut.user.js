// ==UserScript==
// @name         Parasut Gider Formu Excel Doldurucu
// @namespace    ajans-parasut
// @version      1.2.16
// @description  Excel satırlarından gider formunu doldurur ve tedarikçi ödemelerini yarı otomatik girer
// @match        https://uygulama.parasut.com/*
// @exclude      https://uygulama.parasut.com/*render_trinity_iframe=true*
// @updateURL    https://raw.githubusercontent.com/emredemirhan/efsos_para_otomasyon/main/dist/parasut.user.js
// @downloadURL  https://raw.githubusercontent.com/emredemirhan/efsos_para_otomasyon/main/dist/parasut.user.js
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==
(() => {
  // src/config/constants.js
  var PANEL_ID = "ajans-gider-panel";
  var STORAGE_TEXT_KEY = "ajans-gider-text-v1";
  var STORAGE_INDEX_KEY = "ajans-gider-selected-index-v1";
  var STORAGE_POS_KEY = "ajans-gider-panel-pos-v1";
  var STORAGE_MIN_KEY = "ajans-gider-panel-minimized-v1";

  // src/core/format.js
  function parseAmount(value) {
    if (typeof value === "number") return value;
    const cleaned = String(value || "").replace(/TL/gi, "").replace(/[^\d,.-]/g, "").trim();
    if (!cleaned) return 0;
    if (cleaned.includes(",")) {
      return Number(cleaned.replace(/\./g, "").replace(",", "."));
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      return Number(cleaned.replace(/\./g, ""));
    }
    return Number(cleaned.replace(/,/g, ""));
  }
  function formatAmountTR(value) {
    const number = parseAmount(value);
    return new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number || 0);
  }
  function parseDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const excelDatePattern = new RegExp("^\\d{5}$");
    const slashDatePattern = new RegExp(
      "^(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?$"
    );
    const compactTrDatePattern = new RegExp(
      "^(\\d{2})(\\d{2})[-./](\\d{2}|\\d{4})$"
    );
    const trDatePattern = new RegExp("^(\\d{1,2})[.-](\\d{1,2})[.-](\\d{4})$");
    const isoDatePattern = new RegExp("^(\\d{4})-(\\d{1,2})-(\\d{1,2})$");
    const normalizeYear = (yearText) => {
      if (!yearText) return (/* @__PURE__ */ new Date()).getFullYear();
      const year = Number(yearText);
      return year < 100 ? 2e3 + year : year;
    };
    const makeDate = (year, month, day) => {
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
      }
      return date;
    };
    if (excelDatePattern.test(raw)) {
      const d = new Date(1899, 11, 30);
      d.setDate(d.getDate() + Number(raw));
      return d;
    }
    const iso = raw.match(isoDatePattern);
    if (iso) {
      return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }
    const slash = raw.match(slashDatePattern);
    if (slash) {
      return makeDate(normalizeYear(slash[3]), Number(slash[2]), Number(slash[1]));
    }
    const compactTr = raw.match(compactTrDatePattern);
    if (compactTr) {
      return makeDate(
        normalizeYear(compactTr[3]),
        Number(compactTr[2]),
        Number(compactTr[1])
      );
    }
    const tr = raw.match(trDatePattern);
    if (tr) {
      return makeDate(Number(tr[3]), Number(tr[2]), Number(tr[1]));
    }
    return null;
  }
  function formatDateTR(date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }
  function nextPaymentDate() {
    const today = /* @__PURE__ */ new Date();
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 5);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  // src/core/text.js
  function norm(value) {
    return String(value || "").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();
  }
  function elementText(el) {
    return String(el?.innerText || el?.textContent || "");
  }
  function keyify(value) {
    return String(value || "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
  }

  // src/core/tableParser.js
  var HEADER_KEYS = [
    "toplam_tutar",
    "toplam",
    "tutar",
    "kalem_tutari",
    "gider_tutari",
    "ana_gider_tutari",
    "kisi",
    "tedarikci",
    "tedarikci_kisi",
    "kayit_ismi",
    "kayit_kalemi",
    "aciklama",
    "kalem",
    "kalemler",
    "marka",
    "kategori",
    "gider_kategorisi",
    "fis_fatura_tarihi",
    "fatura_tarihi",
    "odenecegi_tarih",
    "odeme_tarihi",
    "etiket",
    "odeme_tutari",
    "odeme_tutarlari",
    "odeme",
    "odeme_hesabi",
    "odeme_hesaplari",
    "cikis_hesabi",
    "hesap"
  ];
  function pick(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== void 0 && String(obj[key]).trim() !== "") {
        return obj[key];
      }
    }
    return "";
  }
  function splitSlash(value) {
    return String(value || "").split("/").map((part) => part.trim()).filter((part) => part !== "");
  }
  function buildPayments({ amountRaw, dateRaw, accountRaw, description }) {
    const amounts = splitSlash(amountRaw);
    if (!amounts.length) return [];
    const isMulti = amounts.length > 1;
    const dates = isMulti ? splitSlash(dateRaw) : [String(dateRaw || "").trim()].filter(Boolean);
    const accounts = isMulti ? splitSlash(accountRaw) : [String(accountRaw || "").trim()].filter(Boolean);
    return amounts.map((amount, index) => {
      const dateText = dates[index] ?? dates[0] ?? "";
      const accountText = accounts[index] ?? accounts[0] ?? "";
      return {
        amount,
        amountNumber: parseAmount(amount),
        dateText,
        date: parseDate(dateText),
        account: accountText,
        description
      };
    });
  }
  function detectFormat(rows, mutateRows = false) {
    if (!rows.length) {
      return {
        headers: [],
        firstRowKeys: [],
        hasHeader: false,
        detectedFormat: "empty"
      };
    }
    const firstRowKeys = rows[0].map(keyify);
    const hasHeader = firstRowKeys.some((key) => HEADER_KEYS.includes(key));
    if (hasHeader) {
      const headerRow = mutateRows ? rows.shift() : rows[0];
      return {
        headers: headerRow.map(keyify),
        firstRowKeys,
        hasHeader: true,
        detectedFormat: "header"
      };
    }
    if (rows[0]?.length === 4) {
      return {
        headers: ["kisi", "marka", "kalem_tutari", "kayit_ismi"],
        firstRowKeys,
        hasHeader: false,
        detectedFormat: "four-column-expense"
      };
    }
    if (rows[0]?.length === 5) {
      return {
        headers: ["kisi", "marka", "grup_toplam", "kalem_tutari", "kayit_ismi"],
        firstRowKeys,
        hasHeader: false,
        detectedFormat: "five-column-expense"
      };
    }
    if (rows[0]?.length === 7) {
      return {
        headers: [
          "kisi",
          "marka",
          "kalem_tutari",
          "kayit_ismi",
          "odeme_tutari",
          "odeme_hesabi",
          "odeme_tarihi"
        ],
        firstRowKeys,
        hasHeader: false,
        detectedFormat: "seven-column-expense-payment"
      };
    }
    if (rows[0]?.length === 8) {
      return {
        headers: [
          "kisi",
          "marka",
          "grup_toplam",
          "kalem_tutari",
          "kayit_ismi",
          "odeme_tutari",
          "odeme_hesabi",
          "odeme_tarihi"
        ],
        firstRowKeys,
        hasHeader: false,
        detectedFormat: "eight-column-expense-payment"
      };
    }
    return {
      headers: [
        "toplam_tutar",
        "kisi",
        "kayit_ismi",
        "marka",
        "fis_fatura_tarihi",
        "odenecegi_tarih",
        "etiket"
      ],
      firstRowKeys,
      hasHeader: false,
      detectedFormat: "legacy-default"
    };
  }
  function parseRawRow(cols, headers) {
    const raw = {};
    headers.forEach((h, i) => {
      raw[h] = cols[i] || "";
    });
    const amount = pick(raw, [
      "kalem_tutari",
      "gider_tutari",
      "ana_gider_tutari",
      "tutar",
      "toplam_tutar",
      "toplam",
      "amount"
    ]);
    const supplier = pick(raw, [
      "kisi",
      "tedarikci",
      "tedarikci_adi",
      "tedarikci_kisi",
      "kisi_tedarikci"
    ]);
    const title = pick(raw, [
      "kayit_ismi",
      "kayit_kalemi",
      "kayit",
      "aciklama",
      "kalem",
      "kalemler",
      "is_adi",
      "proje"
    ]);
    const brand = pick(raw, ["marka", "kategori", "gider_kategorisi"]);
    const tag = pick(raw, ["etiket", "tag"]);
    const issueDateRaw = pick(raw, [
      "fis_fatura_tarihi",
      "fatura_tarihi",
      "tarih"
    ]);
    const dueDateRaw = pick(raw, ["odenecegi_tarih", "odeme_tarihi"]);
    const paymentAmountRaw = pick(raw, [
      "odeme_tutari",
      "odeme_tutarlari",
      "odeme"
    ]);
    const paymentDateRaw = pick(raw, ["odeme_tarihi", "odenecegi_tarih"]);
    const paymentAccountRaw = pick(raw, [
      "odeme_hesabi",
      "odeme_hesaplari",
      "cikis_hesabi",
      "hesap"
    ]);
    const payments = buildPayments({
      amountRaw: paymentAmountRaw,
      dateRaw: paymentDateRaw,
      accountRaw: paymentAccountRaw,
      description: title
    });
    return {
      raw,
      row: {
        amount,
        supplier,
        title,
        brand,
        rawBrand: brand,
        tag,
        issueDate: parseDate(issueDateRaw) || /* @__PURE__ */ new Date(),
        dueDate: parseDate(dueDateRaw) || nextPaymentDate(),
        payments
      }
    };
  }
  function getRejectedReason(row) {
    if (!parseAmount(row.amount)) return "amount-empty-or-zero";
    if (!row.supplier && !row.title && !row.brand) return "missing-row-identity";
    return "";
  }
  function parseDelimitedText(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      const next = source[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === "	" && !inQuotes) {
        row.push(cell.trim());
        cell = "";
        continue;
      }
      if (char === "\n" && !inQuotes) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += char;
    }
    if (cell.length || row.length) {
      row.push(cell.trim());
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }
  function parseTable(text) {
    const rows = parseDelimitedText(text);
    if (!rows.length) return [];
    const { headers } = detectFormat(rows, true);
    return rows.map((cols) => parseRawRow(cols, headers).row).filter((row) => !getRejectedReason(row));
  }
  function getPaymentRecords(text) {
    const rows = Array.isArray(text) ? text : parseTable(text);
    const records = [];
    rows.forEach((row, rowIndex) => {
      const payments = Array.isArray(row.payments) ? row.payments : [];
      payments.forEach((payment, paymentIndex) => {
        records.push({
          supplier: row.supplier,
          itemName: row.title,
          description: payment.description || row.title,
          amount: payment.amount,
          amountNumber: payment.amountNumber,
          date: payment.date,
          dateText: payment.dateText,
          account: payment.account,
          rowIndex,
          paymentIndex,
          paymentCount: payments.length
        });
      });
    });
    return records;
  }
  function inspectTableParse(text) {
    const source = String(text || "");
    const rows = parseDelimitedText(source);
    const format = detectFormat([...rows]);
    const dataRows = format.hasHeader ? rows.slice(1) : rows;
    const accepted = [];
    const rejected = [];
    dataRows.forEach((cols, index) => {
      const parsed = parseRawRow(cols, format.headers);
      const reason = getRejectedReason(parsed.row);
      const item = {
        rowNumber: format.hasHeader ? index + 2 : index + 1,
        columnCount: cols.length,
        columns: cols,
        raw: parsed.raw,
        parsed: {
          supplier: parsed.row.supplier,
          brand: parsed.row.brand,
          amount: parsed.row.amount,
          title: parsed.row.title,
          tag: parsed.row.tag
        },
        amountNumber: parseAmount(parsed.row.amount)
      };
      if (reason) {
        rejected.push({ ...item, reason });
      } else {
        accepted.push(item);
      }
    });
    return {
      textLength: source.length,
      trimmedLength: source.trim().length,
      lineCount: source ? source.replace(/\r\n/g, "\n").split("\n").length : 0,
      tabCount: (source.match(/\t/g) || []).length,
      semicolonCount: (source.match(/;/g) || []).length,
      commaCount: (source.match(/,/g) || []).length,
      parsedPhysicalRows: rows.length,
      firstRowColumnCount: rows[0]?.length || 0,
      firstRow: rows[0] || [],
      firstRowKeys: format.firstRowKeys,
      hasHeader: format.hasHeader,
      detectedFormat: format.detectedFormat,
      headers: format.headers,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      acceptedPreview: accepted.slice(0, 5),
      rejectedPreview: rejected.slice(0, 10),
      textPreview: source.slice(0, 500)
    };
  }

  // src/parasut/dom.js
  var $ = (selector, root = document) => root.querySelector(selector);
  var $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function isVisible(el) {
    if (!el) return false;
    const view = el.ownerDocument?.defaultView || window;
    const style = view.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
  }
  function getActiveAppDocument() {
    const iframe = $("iframe[name='trinity-iframe'], iframe[data-type='trinity']");
    if (iframe && isVisible(iframe)) {
      try {
        if (iframe.contentDocument?.body) return iframe.contentDocument;
      } catch (err) {
        console.warn("[AJANS] Trinity iframe dok\xFCman\u0131na eri\u015Filemedi:", err);
      }
    }
    return document;
  }
  function findFillableInput(root) {
    if (!root) return null;
    const inputs = $$("input, textarea", root).filter(
      (el) => el.type !== "hidden" && el.type !== "file"
    );
    return inputs.find(isVisible) || inputs[0] || null;
  }
  async function waitFor(fn, timeout = 8e3, interval = 150) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = fn();
      if (result) return result;
      await sleep(interval);
    }
    throw new Error("Beklenen alan bulunamad\u0131.");
  }
  function setNativeValue(el, value, options = {}) {
    if (!el) throw new Error("Input bulunamad\u0131.");
    const shouldBlur = options.blur !== false;
    const shouldKeyup = options.keyup !== false;
    const view = el.ownerDocument?.defaultView || window;
    const wasReadonly = el.hasAttribute("readonly");
    if (wasReadonly) el.removeAttribute("readonly");
    el.focus();
    const proto = el instanceof view.HTMLTextAreaElement ? view.HTMLTextAreaElement.prototype : view.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new view.Event("input", { bubbles: true }));
    el.dispatchEvent(new view.Event("change", { bubbles: true }));
    if (shouldKeyup) {
      el.dispatchEvent(new view.KeyboardEvent("keyup", { bubbles: true }));
    }
    if (shouldBlur) {
      el.dispatchEvent(new view.Event("blur", { bubbles: true }));
    }
    if (wasReadonly) el.setAttribute("readonly", "");
  }
  function sendKey(el, key) {
    if (!el) return;
    const view = el.ownerDocument?.defaultView || window;
    const keyCode = key === "Enter" ? 13 : 0;
    const common = {
      key,
      code: key,
      which: keyCode,
      keyCode,
      bubbles: true,
      cancelable: true
    };
    el.dispatchEvent(new view.KeyboardEvent("keydown", common));
    el.dispatchEvent(new view.KeyboardEvent("keypress", common));
    el.dispatchEvent(new view.KeyboardEvent("keyup", common));
  }
  function clickWithoutDefaultNavigation(el) {
    if (!el) return;
    const doc = el.ownerDocument || document;
    const view = doc.defaultView || window;
    const preventOwnDefault = (event) => {
      if (event.target === el || el.contains?.(event.target)) {
        event.preventDefault();
      }
    };
    doc.addEventListener("click", preventOwnDefault, true);
    try {
      el.dispatchEvent(
        new view.MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view,
          button: 0
        })
      );
      el.dispatchEvent(
        new view.MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view,
          button: 0
        })
      );
      el.click();
    } finally {
      doc.removeEventListener("click", preventOwnDefault, true);
    }
  }
  function getVisibleDropdownRoots(root = getActiveAppDocument()) {
    const roots = $$(
      ".dropdownContent, .ember-basic-dropdown-content, .ember-power-select-dropdown, [role='listbox']",
      root
    ).filter(isVisible);
    return roots.length ? roots : [root];
  }

  // src/parasut/fields.js
  function findInputByLabels(labelTexts, root = getActiveAppDocument()) {
    const wantedLabels = labelTexts.map(norm);
    for (const wanted of wantedLabels) {
      const labels = $$("label", root).filter(
        (el) => norm(elementText(el)).includes(wanted)
      );
      labels.sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));
      for (const label of labels) {
        const labelForInput = label.htmlFor ? label.ownerDocument.getElementById(label.htmlFor) : null;
        if (labelForInput?.matches("input, textarea")) return labelForInput;
        const field = label.closest('[class*="__p-field__"]') || label.closest(".field") || label.closest(".fieldGroup") || label.parentElement;
        const fieldInput = findFillableInput(field);
        if (fieldInput) return fieldInput;
        const fieldContentInput = findFillableInput(
          label.parentElement?.querySelector('[class*="__p-field-content__"]')
        ) || findFillableInput(label.nextElementSibling) || findFillableInput(label.parentElement?.nextElementSibling);
        if (fieldContentInput) return fieldContentInput;
        const fieldsetInput = findFillableInput(label.closest("fieldset"));
        if (fieldsetInput) return fieldsetInput;
      }
    }
    return null;
  }
  function setRequiredField(labelTexts, value, fieldName) {
    const root = getActiveAppDocument();
    const input = findInputByLabels(labelTexts, root);
    if (!input) {
      console.warn(
        "[AJANS] Alan bulunamad\u0131:",
        fieldName,
        "Aranan label'lar:",
        labelTexts,
        "Sayfadaki label'lar:",
        $$("label", root).map(
          (label) => elementText(label).replace(/\s+/g, " ").trim()
        )
      );
      throw new Error(`${fieldName} alan\u0131 bulunamad\u0131.`);
    }
    setNativeValue(input, value);
  }
  function setOptionalField(labelTexts, value, root = getActiveAppDocument()) {
    const input = findInputByLabels(labelTexts, root);
    if (input) {
      setNativeValue(input, value);
    }
  }
  function findSectionByHeadings(headingTexts, root = getActiveAppDocument()) {
    const wantedHeadings = headingTexts.map(norm);
    const heading = $$("h4, h3, label, strong", root).find(
      (el) => wantedHeadings.some((wanted) => norm(elementText(el)).includes(wanted))
    );
    if (!heading) return null;
    return heading.closest(".inner-container") || heading.closest(".field") || heading.closest(".fieldGroup") || heading.closest("[class*='category']") || heading.closest("[class*='tag']") || heading.parentElement;
  }

  // src/parasut/dropdowns.js
  var DROPDOWN_SEARCH_MIN_WAIT_MS = 1100;
  function getOptionTitle(el) {
    return el.querySelector("[title]")?.getAttribute("title") || el.getAttribute("title") || elementText(el);
  }
  async function selectFromDropdown(sectionNames, value, type) {
    if (!value) return;
    const labels = Array.isArray(sectionNames) ? sectionNames : [sectionNames];
    const section = findSectionByHeadings(labels);
    const displayName = labels[0];
    if (!section) throw new Error(`${displayName} alan\u0131 bulunamad\u0131.`);
    const trigger = $$(
      "button, [role='button'], .ember-basic-dropdown-trigger, .ember-power-select-trigger",
      section
    ).find(isVisible);
    if (!trigger) throw new Error(`${displayName} a\xE7ma butonu bulunamad\u0131.`);
    trigger.click();
    await sleep(400);
    const searchInput = await waitFor(() => {
      const roots = getVisibleDropdownRoots();
      for (const root of roots) {
        const input = $$(
          "input[placeholder*='Ara'], input[placeholder*='Etiket'], input[name='category_search_field'], input[name='tag_search_field'], .bootstrap-tagsinput input",
          root
        ).find(isVisible);
        if (input) return input;
      }
      return null;
    }, 4e3).catch(() => null);
    if (searchInput) {
      setNativeValue(searchInput, value, { blur: false });
      await sleep(DROPDOWN_SEARCH_MIN_WAIT_MS);
    }
    const wanted = norm(value);
    const selected = await waitFor(() => {
      const candidates = [];
      for (const root of getVisibleDropdownRoots()) {
        candidates.push(
          ...$$(
            "[data-tid='select-category'], [data-tid='toggleTag'], .ember-power-select-option, li a, a, button",
            root
          ).filter(isVisible)
        );
      }
      if (!candidates.length) return null;
      const exact = candidates.find((el) => norm(getOptionTitle(el)) === wanted);
      if (exact) return exact;
      const partial = candidates.find(
        (el) => norm(getOptionTitle(el)).includes(wanted)
      );
      if (partial) return partial;
      return null;
    }, 3500).catch(() => null);
    if (!selected) {
      throw new Error(`${type} bulunamad\u0131: ${value}`);
    }
    selected.click();
    await sleep(500);
  }
  async function selectCategory(name) {
    await selectFromDropdown(
      ["G\u0130DER KATEGOR\u0130S\u0130", "KATEGOR\u0130", "HARCAMA KATEGOR\u0130S\u0130"],
      name,
      "Kategori"
    );
  }
  async function selectTag(name) {
    await selectFromDropdown(["ET\u0130KETLER", "ET\u0130KET"], name, "Etiket");
  }

  // src/parasut/datepicker.js
  var DUE_DATE_SHORTCUT_HINTS = [
    "B\u0130L\u0130NM\u0130YOR",
    "AY BA\u015EINDA",
    "1 HAFTA SONRA",
    "2 HAFTA SONRA",
    "1 AY SONRA",
    "2 AY SONRA"
  ];
  function hasDueDateShortcuts(container) {
    const buttons = $$("button", container);
    if (!buttons.length) return false;
    const texts = buttons.map((btn) => norm(elementText(btn)));
    return DUE_DATE_SHORTCUT_HINTS.some(
      (hint) => texts.some((text) => text.includes(hint))
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
    return wantedLabels.flatMap(
      (wanted) => elements.filter((el) => norm(elementText(el)).includes(wanted))
    );
  }
  function findCalendarByLabels(labelTexts, root = getActiveAppDocument()) {
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
    return $$("input", picker).find(
      (el) => (el.type === "text" || !el.type) && isVisible(el)
    ) || null;
  }
  function findInlinePikaSingle(picker) {
    if (!picker) return null;
    const all = $$(".pika-single", picker);
    return all.find((el) => !el.classList.contains("is-bound") && isVisible(el)) || all.find((el) => !el.classList.contains("is-bound")) || null;
  }
  function findVisibleBoundPikaSingle(doc) {
    const scope = doc?.body || doc || getActiveAppDocument();
    const all = $$(".pika-single.is-bound", scope);
    return all.find((el) => !el.classList.contains("is-hidden") && isVisible(el)) || null;
  }
  function setSelectValue(select, value) {
    if (!select) return false;
    if (Number(select.value) === Number(value)) return false;
    const view = select.ownerDocument?.defaultView || window;
    const setter = Object.getOwnPropertyDescriptor(
      view.HTMLSelectElement.prototype,
      "value"
    )?.set;
    if (setter) setter.call(select, String(value));
    else select.value = String(value);
    select.dispatchEvent(new view.Event("change", { bubbles: true }));
    return true;
  }
  async function setPikadayDate(pikaSingle, date) {
    if (!pikaSingle) return false;
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();
    const yearSelect = pikaSingle.querySelector("select.pika-select-year");
    const monthSelect = pikaSingle.querySelector("select.pika-select-month");
    const yearChanged = setSelectValue(yearSelect, targetYear);
    const monthChanged = setSelectValue(monthSelect, targetMonth);
    if (yearChanged || monthChanged) await sleep(350);
    const selector = `button.pika-day[data-pika-year='${targetYear}'][data-pika-month='${targetMonth}'][data-pika-day='${targetDay}']`;
    const dayButton = await waitFor(
      () => pikaSingle.querySelector(selector),
      2500
    ).catch(() => null);
    if (!dayButton) {
      console.warn(
        "[AJANS] Pikaday g\xFCn butonu bulunamad\u0131:",
        formatDateTR(date),
        "container:",
        pikaSingle
      );
      return false;
    }
    dayButton.click();
    await sleep(250);
    return true;
  }
  async function setLegacyPikadayDate(pikaSingle, date) {
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
        (td) => !td.classList.contains("is-empty") && Number(td.getAttribute("data-day")) === targetDay && td.querySelector("button.pika-button")
      );
      return cell ? cell.querySelector("button.pika-button") : null;
    }, 2500).catch(() => null);
    if (!dayButton) {
      console.warn(
        "[AJANS] Eski pikaday g\xFCn butonu bulunamad\u0131:",
        formatDateTR(date)
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
    } catch {
    }
    input.dispatchEvent(new view.MouseEvent("mousedown", { bubbles: true }));
    input.dispatchEvent(new view.MouseEvent("mouseup", { bubbles: true }));
    try {
      input.click();
    } catch {
    }
    return waitFor(() => findVisibleBoundPikaSingle(doc), 2500).catch(() => null);
  }
  async function closeBoundPikaday(input) {
    if (!input) return;
    try {
      input.blur();
    } catch {
    }
    const doc = input.ownerDocument || document;
    const view = doc.defaultView || window;
    doc.body?.dispatchEvent(
      new view.MouseEvent("mousedown", { bubbles: true })
    );
    await sleep(150);
  }
  async function setDateFieldByLabels(labelTexts, date) {
    if (!date) return false;
    const root = getActiveAppDocument();
    const picker = await waitFor(
      () => findCalendarByLabels(labelTexts, root),
      3500
    ).catch(() => null);
    if (!picker) {
      console.warn(
        "[AJANS] Tarih alan\u0131 bulunamad\u0131. Aranan label'lar:",
        labelTexts
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
        "[AJANS] Pikaday popup a\xE7\u0131lamad\u0131, hidden input fallback denenecek."
      );
      setNativeValue(hiddenInput, formatDateTR(date));
      return true;
    }
    console.warn(
      "[AJANS] Tarih takvimi doldurulamad\u0131:",
      formatDateTR(date),
      "label:",
      labelTexts
    );
    return false;
  }

  // src/parasut/pageDetection.js
  function getWindowPathname(targetWindow) {
    try {
      return targetWindow?.location?.pathname || "";
    } catch {
      return "";
    }
  }
  function getTrinityIframePathnames() {
    return $$("iframe[name='trinity-iframe'], iframe[data-type='trinity']").map((iframe) => getWindowPathname(iframe.contentWindow)).filter(Boolean);
  }
  var RELEVANT_ROUTE_PATTERN = /\/(?:fis-faturalar|tedarikciler)(?:\/|$)/;
  function getAppPathname() {
    const currentPathname = getWindowPathname(window);
    const topPathname = getWindowPathname(window.top);
    const iframePathnames = getTrinityIframePathnames();
    const relevantIframe = iframePathnames.find(
      (pathname) => RELEVANT_ROUTE_PATTERN.test(pathname)
    );
    if (relevantIframe) return relevantIframe;
    return [currentPathname, topPathname].find(
      (pathname) => RELEVANT_ROUTE_PATTERN.test(pathname)
    ) || iframePathnames[0] || topPathname || currentPathname || location.pathname;
  }
  function matchesExpenseFormPath(pathname) {
    return /\/fis-faturalar\/yeni(?:\/hizli)?\/?$/.test(pathname);
  }
  function classifyPaymentStage(pathname, root) {
    if (/\/fis-faturalar\/\d+/.test(pathname) && !matchesExpenseFormPath(pathname)) {
      return "bill";
    }
    if (/\/tedarikciler\/\d+/.test(pathname)) return "supplier-detail";
    if ($("[data-tns='purchase-bills-show']", root)) return "bill";
    if ($("[data-test-contact-show-header-name]", root) || $("[data-tns='supplier-show']", root)) {
      return "supplier-detail";
    }
    if ($("[data-tns='supplier-index']", root)) return "suppliers";
    if (/\/tedarikciler\/?$/.test(pathname)) return "suppliers";
    return null;
  }
  function getPageDetectionSnapshot(root = getActiveAppDocument()) {
    const pathname = getAppPathname();
    const hasRecordId = Boolean(
      $("input[data-tid='record-id'][data-ttype='page']", root)
    );
    const hasPurchaseBillShow = Boolean($("[data-tns='purchase-bills-show']", root));
    const isExpense = matchesExpenseFormPath(pathname);
    const paymentStage = isExpense ? null : classifyPaymentStage(pathname, root);
    let flow = "idle";
    if (isExpense) flow = "expense";
    else if (paymentStage) flow = "payment";
    return {
      href: location.href,
      pathname,
      currentPathname: getWindowPathname(window),
      topPathname: getWindowPathname(window.top),
      iframePathnames: getTrinityIframePathnames(),
      activeDocumentPathname: getWindowPathname(root.defaultView),
      hasRecordId,
      hasPurchaseBillShow,
      isExpense,
      paymentStage,
      flow
    };
  }
  function isExpenseFormPage() {
    return getPageDetectionSnapshot().isExpense;
  }
  function getPaymentStage() {
    return getPageDetectionSnapshot().paymentStage;
  }

  // src/parasut/supplier.js
  var SUPPLIER_SEARCH_MIN_WAIT_MS = 1100;
  async function fillSupplier(name) {
    if (!name) return;
    const input = findInputByLabels(["TEDAR\u0130K\xC7\u0130", "K\u0130\u015E\u0130", "CAR\u0130", "F\u0130RMA"]);
    if (!input) throw new Error("Tedarik\xE7i alan\u0131 bulunamad\u0131.");
    setNativeValue(input, name, { blur: false });
    await sleep(SUPPLIER_SEARCH_MIN_WAIT_MS);
    const firstOption = await waitFor(() => {
      const options = $$(
        ".ember-power-select-option, .tt-suggestion, [data-test-option], .autocomplete-result, [role='option'], li a",
        input.ownerDocument
      ).filter(isVisible);
      const wanted = norm(name);
      const exact = options.find((option) => norm(elementText(option)) === wanted);
      const partial = options.find(
        (option) => norm(elementText(option)).includes(wanted)
      );
      return exact || partial || options[0] || null;
    }, 3500).catch(() => null);
    if (!firstOption) {
      throw new Error(`Tedarik\xE7i se\xE7ene\u011Fi bulunamad\u0131: ${name}`);
    }
    input.focus();
    sendKey(input, "Enter");
    await sleep(500);
  }

  // src/parasut/expenseFlow.js
  var ISSUE_DATE_LABELS = [
    "F\u0130\u015E/FATURA TAR\u0130H\u0130",
    "FATURA TAR\u0130H\u0130",
    "F\u0130\u015E TAR\u0130H\u0130",
    "TAR\u0130H"
  ];
  var DUE_DATE_LABELS = ["\xD6DENECE\u011E\u0130 TAR\u0130H", "\xD6DEME TAR\u0130H\u0130", "VADE TAR\u0130H\u0130"];
  function findUnpaidRadio(root) {
    const direct = $("input[name='paymentStatus'][value='unpaid']", root);
    if (direct) return direct;
    const labels = $$("label", root).filter(
      (label) => norm(elementText(label)).includes("\xD6DENECEK")
    );
    for (const label of labels) {
      const inner = label.querySelector(
        "input[type='radio'], input[type='checkbox']"
      );
      if (inner) return inner;
      if (label.htmlFor) {
        const target = label.ownerDocument.getElementById(label.htmlFor);
        if (target?.matches?.("input")) return target;
      }
      const sibling = label.previousElementSibling?.matches?.("input") ? label.previousElementSibling : label.nextElementSibling?.matches?.("input") ? label.nextElementSibling : null;
      if (sibling) return sibling;
      const parentRadio = label.parentElement?.querySelector?.(
        "input[type='radio']"
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
        "[AJANS] '\xD6denecek' radio bulunamad\u0131, \xF6denece\u011Fi tarih alan\u0131 zaten a\xE7\u0131k olabilir."
      );
    }
    return waitFor(() => findCalendarByLabels(DUE_DATE_LABELS), 4e3).catch(
      () => null
    );
  }
  async function setIssueDate(date) {
    const ok = await setDateFieldByLabels(ISSUE_DATE_LABELS, date);
    if (!ok) {
      throw new Error(
        `Fi\u015F/Fatura tarihi doldurulamad\u0131: ${formatDateTR(date)}`
      );
    }
  }
  async function setDueDate(date) {
    const ok = await setDateFieldByLabels(DUE_DATE_LABELS, date);
    if (!ok) {
      console.warn(
        "[AJANS] \xD6denece\u011Fi tarih takvimi doldurulamad\u0131:",
        formatDateTR(date)
      );
    }
  }
  async function fillExpense(row) {
    if (!isExpenseFormPage()) {
      throw new Error(
        "\u015Eu an gider formunda de\u011Filsin. Yeni gider formunu a\xE7\u0131p tekrar dene."
      );
    }
    if (!row.amount) throw new Error("Toplam tutar bo\u015F.");
    if (!row.supplier) throw new Error("K\u0130\u015E\u0130 / tedarik\xE7i bo\u015F.");
    if (!row.brand) throw new Error("MARKA / gider kategorisi bo\u015F.");
    const title = row.title || `${row.brand} gider`;
    setRequiredField(
      ["KAYIT \u0130SM\u0130", "F\u0130\u015E/FATURA ADI", "FATURA ADI", "A\xC7IKLAMA"],
      title,
      "Kay\u0131t ismi"
    );
    await fillSupplier(row.supplier);
    await setIssueDate(row.issueDate);
    setRequiredField(
      ["TOPLAM TUTAR", "GENEL TOPLAM", "TUTAR"],
      formatAmountTR(row.amount),
      "Toplam tutar"
    );
    setOptionalField(["TOPLAM KDV", "KDV"], "0,00");
    await selectUnpaidAndWaitDueDate();
    await setDueDate(row.dueDate);
    await selectCategory(row.brand);
    if (row.tag) {
      await selectTag(row.tag);
    }
  }

  // src/parasut/paymentFlow.js
  function textMatches(candidate, wanted) {
    const a = norm(candidate);
    const b = norm(wanted);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }
  function findByText(elements, wanted) {
    const target = norm(wanted);
    return elements.find((el) => norm(elementText(el)) === target) || elements.find((el) => norm(elementText(el)).includes(target)) || elements.find((el) => target.includes(norm(elementText(el)))) || null;
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
    return anchors.find((a) => textOf(a) === target) || anchors.find((a) => textOf(a).includes(target)) || anchors.find((a) => target.includes(textOf(a))) || null;
  }
  function clickLink(el) {
    if (!el) return;
    const view = el.ownerDocument?.defaultView || window;
    const jq = view.Ember && view.Ember.$ || view.jQuery || view.$;
    if (jq) {
      try {
        jq(el).trigger("click");
        return;
      } catch (err) {
        console.warn("[AJANS] jQuery t\u0131klamas\u0131 ba\u015Far\u0131s\u0131z, native'e d\xFC\u015F\xFCl\xFCyor:", err);
      }
    }
    const opts = { bubbles: true, cancelable: true, view, button: 0 };
    try {
      el.dispatchEvent(new view.MouseEvent("mousedown", opts));
      el.dispatchEvent(new view.MouseEvent("mouseup", opts));
    } catch {
    }
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
    return $("[data-test-search-box] input", root) || $$("input[placeholder='Ara...']", root).find(isVisible) || null;
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
        /^\/(\d+)/
      );
      if (!firm) throw new Error("Tedarik\xE7iler sayfas\u0131na gidilemedi.");
      location.href = `${location.origin}/${firm[1]}/tedarikciler`;
    }
    await waitFor(
      () => getPaymentStage() === "suppliers" && getSuppliersSearchInput(),
      1e4
    );
  }
  function findSupplierRowLink(supplierName) {
    const root = getActiveAppDocument();
    const detailLinks = $$("a[href]", root).filter(
      (a) => /\/tedarikciler\/\d+/.test(hrefPath(a)) && isVisible(a)
    );
    const byHref = pickAnchorByText(
      detailLinks,
      supplierName,
      "[data-test-display-name]"
    );
    if (byHref) return byHref;
    const names = $$("[data-test-display-name]", root).filter(isVisible);
    const target = findByText(names, supplierName);
    return target ? target.closest("a[href]") || target.closest("a") : null;
  }
  async function searchAndOpenSupplier(supplierName) {
    const search = await waitFor(() => getSuppliersSearchInput(), 8e3);
    setNativeValue(search, supplierName, { blur: false });
    await sleep(400);
    search.focus();
    sendKey(search, "Enter");
    const link = await waitFor(() => findSupplierRowLink(supplierName), 9e3).catch(
      () => null
    );
    if (!link) throw new Error(`Tedarik\xE7i bulunamad\u0131: ${supplierName}`);
    clickLink(link);
    await waitFor(() => getPaymentStage() === "supplier-detail", 12e3);
    await waitFor(() => textMatches(getSupplierHeaderName(), supplierName), 8e3).catch(
      () => null
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
          1e4
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
      (a) => /\/fis-faturalar\/\d+/.test(hrefPath(a)) && isVisible(a)
    );
    const byHref = pickAnchorByText(billLinks, itemName, "[data-test-description]");
    if (byHref) return byHref;
    const descriptions = $$("[data-test-description]", root).filter(isVisible);
    const target = findByText(descriptions, itemName);
    return target ? target.closest("a[href]") || target.closest("a") : null;
  }
  async function openExpenseItem(record) {
    const link = await waitFor(() => findExpenseItemLink(record.itemName), 9e3).catch(
      () => null
    );
    if (!link) {
      throw new Error(`Gider kalemi bulunamad\u0131: ${record.itemName}`);
    }
    clickLink(link);
    await waitFor(() => getPaymentStage() === "bill", 12e3);
    await waitFor(() => $("[data-tns='purchase-bills-show']", getActiveAppDocument()), 8e3);
  }
  function findPaymentOpenerButton() {
    const wanted = norm("\xD6DEME EKLE");
    return $$("button", getActiveAppDocument()).filter(isVisible).find((button) => {
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
    if (!opener) throw new Error("'\xD6deme Ekle' butonu bulunamad\u0131.");
    opener.click();
    await waitFor(() => $("[data-tns='add-payment']", getActiveAppDocument()), 7e3);
    await sleep(300);
  }
  function findFieldSetByLabel(form, labelTexts) {
    const wanted = labelTexts.map(norm);
    return $$(".fieldSet", form).find((fieldSet) => {
      const label = fieldSet.querySelector(".fieldSet-label");
      const text = norm(elementText(label));
      return wanted.some((want) => text.includes(want));
    }) || null;
  }
  function ensureCashPayment(form) {
    const cashLabel = $$("label", form).find(
      (label) => norm(elementText(label)).includes("NAK\u0130T")
    );
    const cashRadio = cashLabel && cashLabel.querySelector("input[type='radio']") || $$("input[name='paymentType']", form)[0];
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
      type: el.getAttribute?.("type") || ""
    };
  }
  function urlFromHistoryArgs(view, args) {
    const rawUrl = args[2];
    if (rawUrl === void 0 || rawUrl === null || rawUrl === "") return null;
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
        href: view.location.href
      });
    };
    const wrapHistory = (methodName, original) => {
      if (typeof original !== "function") return original;
      return function guardedPaymentHistoryMethod(...args) {
        const targetUrl = urlFromHistoryArgs(view, args);
        console.info("[AJANS][payment-history]", {
          methodName,
          from: view.location.href,
          to: targetUrl?.href || ""
        });
        if (isCompanyRootHashUrl(targetUrl)) {
          console.warn("[AJANS] \xD6deme otomasyonu root hash y\xF6nlendirmesini engelledi.", {
            methodName,
            from: view.location.href,
            to: targetUrl.href
          });
          return void 0;
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
    return control.getAttribute("data-tid") === "save" || text === "\xD6DEME EKLE";
  }
  function installPaymentSubmitGuard(form) {
    const doc = form.ownerDocument || document;
    const originalSubmit = form.submit;
    const originalRequestSubmit = form.requestSubmit;
    const blockProgrammaticSubmit = () => {
      console.warn("[AJANS] Otomasyon s\u0131ras\u0131nda programatik \xF6deme kaydetme engellendi.");
    };
    const blockSubmit = (event) => {
      if (event.target === form || form.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn("[AJANS] Otomasyon s\u0131ras\u0131nda \xF6deme kaydetme engellendi.");
      }
    };
    const blockSaveClick = (event) => {
      if (!isPaymentSaveControl(event.target, form)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("[AJANS] Otomasyon son \xD6DEME EKLE butonuna basmad\u0131.");
    };
    doc.addEventListener("submit", blockSubmit, true);
    doc.addEventListener("click", blockSaveClick, true);
    try {
      form.submit = blockProgrammaticSubmit;
      form.requestSubmit = blockProgrammaticSubmit;
    } catch (err) {
      console.warn("[AJANS] \xD6deme submit guard form metodlar\u0131n\u0131 saramad\u0131:", err);
    }
    return () => {
      doc.removeEventListener("submit", blockSubmit, true);
      doc.removeEventListener("click", blockSaveClick, true);
      try {
        form.submit = originalSubmit;
        form.requestSubmit = originalRequestSubmit;
      } catch {
      }
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
    const fieldSet = findFieldSetByLabel(form, ["TAR\u0130H"]);
    if (!fieldSet) {
      console.warn("[AJANS] \xD6deme TAR\u0130H alan\u0131 bulunamad\u0131.");
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
      3e3
    ).catch(() => null);
    if (!pikaSingle) {
      console.warn("[AJANS] \xD6deme tarihi takvimi a\xE7\u0131lamad\u0131.");
      return false;
    }
    return setLegacyPikadayDate(pikaSingle, date);
  }
  async function selectPaymentAccount(form, account) {
    const fieldSet = findFieldSetByLabel(form, ["HESAP"]);
    if (!fieldSet) throw new Error("HESAP alan\u0131 bulunamad\u0131.");
    const dropdown = fieldSet.querySelector(".dropdown") || fieldSet;
    const input = dropdown.querySelector("input");
    const caret = dropdown.querySelector("a[class*='field-innerAppend']");
    if (input) {
      try {
        input.focus();
        input.click();
      } catch {
      }
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
      return items.find((item) => norm(elementText(item)) === wanted) || items.find((item) => norm(elementText(item)).includes(wanted)) || items.find((item) => wanted.includes(norm(elementText(item)))) || null;
    }, 6e3).catch(() => null);
    if (!link) throw new Error(`Hesap bulunamad\u0131: ${account}`);
    clickWithoutDefaultNavigation(link);
    await sleep(300);
  }
  function setPaymentAmount(form, amount) {
    const fieldSet = findFieldSetByLabel(form, ["MEBLA\u011E", "MEBLAG"]);
    if (!fieldSet) throw new Error("MEBLA\u011E alan\u0131 bulunamad\u0131.");
    const input = fieldSet.querySelector("input.field-number") || fieldSet.querySelector("input.field") || fieldSet.querySelector("input");
    if (!input) throw new Error("MEBLA\u011E alan\u0131 (input) bulunamad\u0131.");
    setNativeValue(input, formatAmountTR(amount), { blur: false, keyup: false });
  }
  function setPaymentDescription(form, description) {
    if (!description) return;
    const fieldSet = findFieldSetByLabel(form, ["A\xC7IKLAMA", "ACIKLAMA"]);
    if (!fieldSet) {
      console.warn("[AJANS] \xD6deme A\xC7IKLAMA alan\u0131 bulunamad\u0131.");
      return;
    }
    const input = fieldSet.querySelector("input[type='text']") || fieldSet.querySelector("input.field") || fieldSet.querySelector("input");
    if (input) setNativeValue(input, description, { blur: false, keyup: false });
  }
  async function fillPaymentForm(record) {
    const form = await waitFor(
      () => $("[data-tns='add-payment']", getActiveAppDocument()),
      7e3
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
  async function runPayment(record, onProgress = () => {
  }) {
    if (!record) throw new Error("\xD6deme kayd\u0131 yok.");
    if (!record.supplier) throw new Error("Tedarik\xE7i ad\u0131 bo\u015F.");
    if (!record.itemName) throw new Error("Gider kalemi ad\u0131 bo\u015F.");
    if (!record.amount) throw new Error("\xD6deme tutar\u0131 bo\u015F.");
    const stage = getPaymentStage();
    if (stage === "bill" && billMatches(record)) {
      onProgress("Ayn\u0131 gider kalemindeyiz, \xF6deme formu a\xE7\u0131l\u0131yor...");
      await openPaymentForm();
      await fillPaymentForm(record);
      return;
    }
    onProgress(`Tedarik\xE7i a\xE7\u0131l\u0131yor: ${record.supplier}`);
    await ensureSupplierDetail(record);
    onProgress(`Gider kalemi a\xE7\u0131l\u0131yor: ${record.itemName}`);
    await openExpenseItem(record);
    onProgress("\xD6deme formu a\xE7\u0131l\u0131yor...");
    await openPaymentForm();
    onProgress("\xD6deme alanlar\u0131 dolduruluyor...");
    await fillPaymentForm(record);
  }

  // src/parasut/frame.js
  function isIframe() {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }
  function isTrinityRenderFrame() {
    try {
      return new URLSearchParams(window.location.search).get(
        "render_trinity_iframe"
      ) === "true";
    } catch {
      return window.location.href.includes("render_trinity_iframe=true");
    }
  }
  function shouldRunInThisFrame() {
    return !isIframe() && !isTrinityRenderFrame();
  }
  function removeDuplicatePanels() {
    $$(`#${PANEL_ID}`).forEach((panel, index) => {
      if (index > 0) panel.remove();
    });
  }

  // src/panel/storage.js
  function getSavedPanelPosition() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_POS_KEY) || "null");
    } catch {
      return null;
    }
  }
  function savePanelPosition(panel, position = null) {
    const rect = position || panel.getBoundingClientRect();
    localStorage.setItem(
      STORAGE_POS_KEY,
      JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      })
    );
  }
  function getSafePanelPosition() {
    const saved = getSavedPanelPosition();
    if (!saved) return null;
    const left = Math.max(
      0,
      Math.min(Number(saved.left) || 24, window.innerWidth - 120)
    );
    const top = Math.max(
      0,
      Math.min(Number(saved.top) || 110, window.innerHeight - 80)
    );
    return { left, top };
  }
  function getSelectedIndex(rowsLength) {
    const raw = Number(localStorage.getItem(STORAGE_INDEX_KEY) || 0);
    if (!Number.isFinite(raw)) return 0;
    if (raw < 0) return 0;
    if (raw >= rowsLength) return Math.max(0, rowsLength - 1);
    return raw;
  }
  function setSelectedIndex(index) {
    localStorage.setItem(STORAGE_INDEX_KEY, String(index));
  }
  function clearSelectionState() {
    localStorage.removeItem(STORAGE_INDEX_KEY);
  }
  function isPanelMinimized() {
    return localStorage.getItem(STORAGE_MIN_KEY) === "1";
  }
  function setPanelMinimized(minimized) {
    localStorage.setItem(STORAGE_MIN_KEY, minimized ? "1" : "0");
  }

  // src/panel/drag.js
  function makePanelDraggable(panel, handle) {
    let dragging = false;
    let frameId = 0;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let currentLeft = 0;
    let currentTop = 0;
    function applyDragTransform() {
      frameId = 0;
      const translateX = currentLeft - startLeft;
      const translateY = currentTop - startTop;
      panel.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    }
    function scheduleDragTransform() {
      if (frameId) return;
      frameId = window.requestAnimationFrame(applyDragTransform);
    }
    handle.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (target.closest("button") || target.closest("textarea") || target.closest("select") || target.closest("input")) {
        return;
      }
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      currentLeft = startLeft;
      currentTop = startTop;
      panel.style.left = `${startLeft}px`;
      panel.style.top = `${startTop}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.transform = "translate3d(0, 0, 0)";
      panel.style.willChange = "transform";
      document.body.style.userSelect = "none";
      event.preventDefault();
    });
    window.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - 80;
      const maxTop = window.innerHeight - 50;
      currentLeft = Math.max(
        0,
        Math.min(startLeft + event.clientX - startX, maxLeft)
      );
      currentTop = Math.max(
        0,
        Math.min(startTop + event.clientY - startY, maxTop)
      );
      scheduleDragTransform();
    });
    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
      panel.style.transform = "";
      panel.style.willChange = "";
      panel.style.left = `${currentLeft}px`;
      panel.style.top = `${currentTop}px`;
      document.body.style.userSelect = "";
      savePanelPosition(panel, { left: currentLeft, top: currentTop });
    });
  }

  // src/panel/panelTheme.js
  var PANEL_COLORS = Object.freeze({
    ACCENT: "#1f6feb",
    ACCENT_DARK: "#0f4fc1",
    TEXT: "#111827",
    MUTED: "#6b7280",
    BORDER: "#e5e7eb",
    SOFT_BG: "#f8fafc"
  });

  // src/panel/panelHover.js
  var { ACCENT, ACCENT_DARK, TEXT, MUTED, BORDER, SOFT_BG } = PANEL_COLORS;
  function setupHoverEffects(panel) {
    const hoverableButtons = panel.querySelectorAll(
      "#ajans-gider-help-toggle, #ajans-gider-minimize"
    );
    hoverableButtons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        button.style.background = "#f3f4f6";
        button.style.color = TEXT;
      });
      button.addEventListener("mouseleave", () => {
        button.style.background = "transparent";
        button.style.color = MUTED;
      });
    });
    const stepButtons = panel.querySelectorAll(
      "#ajans-gider-prev, #ajans-gider-next"
    );
    stepButtons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        if (button.disabled) return;
        button.style.background = SOFT_BG;
        button.style.borderColor = "#cbd5e1";
      });
      button.addEventListener("mouseleave", () => {
        button.style.background = "#ffffff";
        button.style.borderColor = BORDER;
      });
    });
    const fillButton = panel.querySelector("#ajans-gider-fill");
    if (fillButton) {
      fillButton.addEventListener("mouseenter", () => {
        if (fillButton.disabled) return;
        fillButton.style.background = ACCENT_DARK;
      });
      fillButton.addEventListener("mouseleave", () => {
        if (fillButton.disabled) return;
        fillButton.style.background = ACCENT;
      });
    }
    const editButton = panel.querySelector("#ajans-gider-edit-data");
    if (editButton) {
      editButton.addEventListener("mouseenter", () => {
        editButton.style.color = ACCENT_DARK;
      });
      editButton.addEventListener("mouseleave", () => {
        editButton.style.color = ACCENT;
      });
    }
    const clearButton = panel.querySelector("#ajans-gider-clear");
    if (clearButton) {
      clearButton.addEventListener("mouseenter", () => {
        clearButton.style.color = TEXT;
      });
      clearButton.addEventListener("mouseleave", () => {
        clearButton.style.color = MUTED;
      });
    }
    const select = panel.querySelector("#ajans-gider-row-select");
    if (select) {
      select.addEventListener("mouseenter", () => {
        select.style.borderColor = "#cbd5e1";
      });
      select.addEventListener("mouseleave", () => {
        select.style.borderColor = BORDER;
      });
      select.addEventListener("focus", () => {
        select.style.borderColor = ACCENT;
      });
      select.addEventListener("blur", () => {
        select.style.borderColor = BORDER;
      });
    }
  }

  // src/panel/panelTemplate.js
  var { ACCENT: ACCENT2, TEXT: TEXT2, MUTED: MUTED2, BORDER: BORDER2, SOFT_BG: SOFT_BG2 } = PANEL_COLORS;
  function createPanelElement() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = getPanelShellStyle(getSafePanelPosition());
    panel.innerHTML = getPanelMarkup();
    setupHoverEffects(panel);
    return panel;
  }
  function getPanelShellStyle(savedPos) {
    return `
    position: fixed;
    ${savedPos ? `left:${savedPos.left}px; top:${savedPos.top}px;` : "right:24px; top:110px;"}
    width: 360px;
    z-index: 2147483647;
    background: #ffffff;
    border: 1px solid ${BORDER2};
    border-radius: 14px;
    padding: 0;
    box-shadow: 0 18px 50px rgba(15, 23, 42, .18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: ${TEXT2};
    overflow: hidden;
  `;
  }
  function getPanelMarkup() {
    return `
    <div id="ajans-gider-drag-handle" style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      padding:10px 12px;
      background:#ffffff;
      border-bottom:1px solid ${BORDER2};
      cursor:move;
    ">
      <div style="display:flex; align-items:center; gap:8px; min-width:0;">
        <span aria-hidden="true" style="
          width:8px; height:8px; border-radius:50%;
          background:${ACCENT2}; flex:0 0 auto;
        "></span>
        <div id="ajans-gider-title-text" style="font-weight:600; font-size:13px; color:${TEXT2}; letter-spacing:-0.01em;">
          Gider Doldurucu
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:2px;">
        <button id="ajans-gider-help-toggle" title="Nas\u0131l kullan\u0131l\u0131r?" aria-label="Yard\u0131m" style="
          border:0;
          background:transparent;
          color:${MUTED2};
          border-radius:6px;
          width:26px; height:26px;
          cursor:pointer;
          font-size:14px;
          font-weight:600;
          display:inline-flex; align-items:center; justify-content:center;
        ">?</button>
        <button id="ajans-gider-minimize" title="K\xFC\xE7\xFClt" aria-label="K\xFC\xE7\xFClt" style="
          border:0;
          background:transparent;
          color:${MUTED2};
          border-radius:6px;
          width:26px; height:26px;
          cursor:pointer;
          font-size:16px;
          line-height:1;
          display:inline-flex; align-items:center; justify-content:center;
        ">\u2013</button>
      </div>
    </div>

    <div id="ajans-gider-body" style="padding:12px;">
      <div id="ajans-gider-help" hidden style="
        margin-bottom:10px;
        padding:10px 12px;
        background:${SOFT_BG2};
        border:1px solid ${BORDER2};
        border-radius:10px;
        font-size:12px;
        color:${MUTED2};
        line-height:1.5;
      ">
        <span id="ajans-gider-help-content"></span>
      </div>

      <div id="ajans-gider-data-collapsed" hidden style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:9px 12px;
        background:${SOFT_BG2};
        border:1px solid ${BORDER2};
        border-radius:10px;
        font-size:12px;
        color:${TEXT2};
        margin-bottom:10px;
      ">
        <span style="display:inline-flex; align-items:center; gap:6px; min-width:0;">
          <span aria-hidden="true" style="color:#10b981; font-weight:700;">\u2713</span>
          <span id="ajans-gider-data-summary" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            Veri haz\u0131r
          </span>
        </span>
        <button id="ajans-gider-edit-data" style="
          border:0;
          background:transparent;
          color:${ACCENT2};
          cursor:pointer;
          font-size:12px;
          font-weight:600;
          padding:2px 4px;
        ">D\xFCzenle</button>
      </div>

      <div id="ajans-gider-textarea-wrapper" style="margin-bottom:10px;">
        <textarea id="ajans-gider-textarea" placeholder="Excel sat\u0131rlar\u0131n\u0131 buraya yap\u0131\u015Ft\u0131r" style="
          width:100%;
          height:96px;
          box-sizing:border-box;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size:12px;
          padding:8px 10px;
          border:1px solid ${BORDER2};
          border-radius:10px;
          resize:vertical;
          color:${TEXT2};
          background:#ffffff;
          outline:none;
        "></textarea>
      </div>

      <div id="ajans-gider-empty" style="
        padding:14px;
        background:${SOFT_BG2};
        border:1px dashed ${BORDER2};
        border-radius:10px;
        font-size:12px;
        color:${MUTED2};
        text-align:center;
        line-height:1.5;
      ">
        Veriyi yap\u0131\u015Ft\u0131r\u0131nca se\xE7ili kay\u0131t burada g\xF6r\xFCnecek.
      </div>

      <div id="ajans-gider-record" hidden style="
        border:1px solid ${BORDER2};
        border-radius:12px;
        background:#ffffff;
        overflow:hidden;
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:6px;
          padding:8px 10px;
          background:${SOFT_BG2};
          border-bottom:1px solid ${BORDER2};
        ">
          <button id="ajans-gider-prev" title="\xD6nceki kay\u0131t" aria-label="\xD6nceki kay\u0131t" style="
            border:1px solid ${BORDER2};
            background:#ffffff;
            color:${TEXT2};
            border-radius:7px;
            width:26px; height:26px;
            cursor:pointer;
            font-size:14px;
            line-height:1;
            flex:0 0 auto;
            display:inline-flex; align-items:center; justify-content:center;
          ">\u2039</button>

          <div style="position:relative; flex:1 1 auto; min-width:0;">
            <select id="ajans-gider-row-select" title="Kay\u0131t se\xE7" style="
              appearance:none;
              -webkit-appearance:none;
              width:100%;
              height:28px;
              padding:0 26px 0 10px;
              border:1px solid ${BORDER2};
              border-radius:7px;
              background:#ffffff;
              color:${TEXT2};
              font-size:12px;
              font-weight:600;
              font-family:inherit;
              cursor:pointer;
              outline:none;
              text-overflow:ellipsis;
              white-space:nowrap;
              overflow:hidden;
            "></select>
            <span aria-hidden="true" style="
              position:absolute;
              right:8px; top:50%;
              transform:translateY(-50%);
              pointer-events:none;
              color:${MUTED2};
              font-size:10px;
            ">\u25BE</span>
          </div>

          <button id="ajans-gider-next" title="Sonraki kay\u0131t" aria-label="Sonraki kay\u0131t" style="
            border:1px solid ${BORDER2};
            background:#ffffff;
            color:${TEXT2};
            border-radius:7px;
            width:26px; height:26px;
            cursor:pointer;
            font-size:14px;
            line-height:1;
            flex:0 0 auto;
            display:inline-flex; align-items:center; justify-content:center;
          ">\u203A</button>
        </div>

        <div style="padding:12px;">
          <div id="ajans-gider-supplier" style="
            font-size:15px;
            font-weight:700;
            color:${TEXT2};
            letter-spacing:-0.01em;
            line-height:1.3;
            word-break:break-word;
          ">\u2014</div>

          <div id="ajans-gider-meta" style="
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            margin-top:6px;
            font-size:11px;
            color:${MUTED2};
          "></div>

          <div id="ajans-gider-amount" style="
            margin-top:10px;
            font-size:22px;
            font-weight:700;
            color:${TEXT2};
            letter-spacing:-0.02em;
          ">\u20BA 0,00</div>

          <div id="ajans-gider-dates" style="
            margin-top:4px;
            font-size:11px;
            color:${MUTED2};
          "></div>

          <div id="ajans-gider-title" title="" style="
            margin-top:10px;
            padding-top:10px;
            border-top:1px solid ${BORDER2};
            font-size:12px;
            color:${MUTED2};
            line-height:1.45;
            word-break:break-word;
            display:-webkit-box;
            -webkit-line-clamp:2;
            -webkit-box-orient:vertical;
            overflow:hidden;
          ">\u2014</div>
        </div>
      </div>

      <div id="ajans-gider-status-wrapper" hidden style="
        margin-top:10px;
        display:flex;
        align-items:flex-start;
        gap:6px;
        font-size:11px;
        color:${MUTED2};
        line-height:1.45;
      ">
        <span id="ajans-gider-status-icon" aria-hidden="true" style="flex:0 0 auto;">\xB7</span>
        <span id="ajans-gider-status"></span>
      </div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-top:12px;
      ">
        <button id="ajans-gider-clear" style="
          padding:0 4px;
          background:transparent;
          color:${MUTED2};
          border:0;
          border-radius:6px;
          font-size:12px;
          font-weight:500;
          cursor:pointer;
          text-decoration:underline;
          text-underline-offset:3px;
        ">Temizle</button>

        <div id="ajans-gider-expense-actions" style="display:none;">
          <button id="ajans-gider-fill" style="
            padding:9px 14px;
            background:${ACCENT2};
            color:#ffffff;
            border:0;
            border-radius:9px;
            font-weight:600;
            font-size:13px;
            cursor:pointer;
            box-shadow: 0 1px 0 rgba(15,23,42,.05);
            letter-spacing:-0.01em;
          ">Ana Gideri Doldur</button>
        </div>

        <div id="ajans-gider-payment-actions" style="display:none;">
          <button id="ajans-gider-pay" style="
            padding:9px 14px;
            background:${ACCENT2};
            color:#ffffff;
            border:0;
            border-radius:9px;
            font-weight:600;
            font-size:13px;
            cursor:pointer;
            box-shadow: 0 1px 0 rgba(15,23,42,.05);
            letter-spacing:-0.01em;
          ">\xD6demeyi Ba\u015Flat</button>
        </div>
      </div>
    </div>
  `;
  }

  // src/panel/panelState.js
  var { ACCENT: ACCENT3, ACCENT_DARK: ACCENT_DARK2, MUTED: MUTED3 } = PANEL_COLORS;
  function setStatus(message, tone = "info") {
    const wrapper = $("#ajans-gider-status-wrapper");
    const status = $("#ajans-gider-status");
    const icon = $("#ajans-gider-status-icon");
    if (!wrapper || !status || !icon) return;
    const text = String(message || "").trim();
    if (!text || text === "Haz\u0131r." || text === "Haz\u0131r") {
      wrapper.hidden = true;
      status.textContent = "";
      return;
    }
    wrapper.hidden = false;
    status.textContent = text;
    const statusTone = tone === true ? "error" : tone;
    wrapper.style.background = "transparent";
    wrapper.style.border = "0";
    wrapper.style.borderRadius = "0";
    wrapper.style.padding = "0";
    if (statusTone === "error") {
      icon.textContent = "!";
      icon.style.color = "#b42318";
      status.style.color = "#b42318";
    } else if (statusTone === "success") {
      wrapper.style.background = "#ecfdf3";
      wrapper.style.border = "1px solid #abefc6";
      wrapper.style.borderRadius = "8px";
      wrapper.style.padding = "8px 10px";
      icon.textContent = "OK";
      icon.style.color = "#067647";
      status.style.color = "#067647";
    } else {
      icon.textContent = "\xB7";
      icon.style.color = MUTED3;
      status.style.color = MUTED3;
    }
  }
  function setFillButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Dolduruluyor..." : "Ana Gideri Doldur";
    button.style.opacity = loading ? "0.65" : "1";
    button.style.cursor = loading ? "not-allowed" : "pointer";
    button.style.background = loading ? ACCENT_DARK2 : ACCENT3;
  }
  function setPayButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "\xC7al\u0131\u015F\u0131yor..." : "\xD6demeyi Ba\u015Flat";
    button.style.opacity = loading ? "0.65" : "1";
    button.style.cursor = loading ? "not-allowed" : "pointer";
    button.style.background = loading ? ACCENT_DARK2 : ACCENT3;
  }
  function applyMinimizedState(panel, body, button) {
    const minimized = isPanelMinimized();
    body.style.display = minimized ? "none" : "block";
    button.title = minimized ? "A\xE7" : "K\xFC\xE7\xFClt";
    button.setAttribute("aria-label", minimized ? "A\xE7" : "K\xFC\xE7\xFClt");
    button.textContent = minimized ? "+" : "\u2013";
    panel.style.width = minimized ? "240px" : "360px";
  }

  // src/panel/controller.js
  var isFilling = false;
  var isRunningPayment = false;
  var lastDecisionLogKey = "";
  var lastParseDebugKey = "";
  var isDataEditorOpen = true;
  var isHelpOpen = false;
  var paymentAwaitingManualSave = false;
  function appendDebugLog(event, details = {}) {
    const entry = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      event,
      href: location.href,
      hasPanel: Boolean($(`#${PANEL_ID}`)),
      ...details
    };
    console.info("[AJANS][debug]", entry);
    try {
      const key = "ajans-gider-debug-log-v1";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      const next = [...current, entry].slice(-80);
      localStorage.setItem(key, JSON.stringify(next));
      window.__AJANS_GIDER_LAST_DEBUG__ = entry;
      window.__AJANS_GIDER_DEBUG_LOG__ = next;
      window.ajansGiderDebug = () => JSON.parse(localStorage.getItem(key) || "[]");
    } catch (err) {
      console.warn("[AJANS][debug] Log kaydedilemedi:", err);
    }
  }
  function getTextareaDebugSnapshot(text) {
    const value = String(text || "");
    const parse = inspectTableParse(value);
    return {
      ...parse,
      storageTextLength: String(localStorage.getItem(STORAGE_TEXT_KEY) || "").length,
      textareaExists: Boolean($("#ajans-gider-textarea"))
    };
  }
  function installDebugHelpers() {
    window.ajansGiderParseDebug = (text = null) => {
      const textarea = $("#ajans-gider-textarea");
      const value = text === null ? textarea?.value || "" : text;
      const snapshot = getTextareaDebugSnapshot(value);
      console.info("[AJANS][parse-debug]", snapshot);
      if (snapshot.acceptedPreview.length) {
        console.table(
          snapshot.acceptedPreview.map((item) => ({
            row: item.rowNumber,
            cols: item.columnCount,
            supplier: item.parsed.supplier,
            category: item.parsed.brand,
            amount: item.parsed.amount,
            amountNumber: item.amountNumber,
            title: item.parsed.title
          }))
        );
      }
      if (snapshot.rejectedPreview.length) {
        console.table(
          snapshot.rejectedPreview.map((item) => ({
            row: item.rowNumber,
            reason: item.reason,
            cols: item.columnCount,
            firstColumn: item.columns[0],
            parsedAmount: item.parsed.amount,
            amountNumber: item.amountNumber
          }))
        );
      }
      return snapshot;
    };
    window.ajansGiderTextareaValue = () => $("#ajans-gider-textarea")?.value || "";
  }
  function logParseSnapshot(source, text, options = {}) {
    const snapshot = getTextareaDebugSnapshot(text);
    const key = [
      source,
      snapshot.textLength,
      snapshot.tabCount,
      snapshot.parsedPhysicalRows,
      snapshot.acceptedCount,
      snapshot.rejectedCount,
      snapshot.detectedFormat
    ].join("|");
    if (!options.force && key === lastParseDebugKey) return snapshot;
    lastParseDebugKey = key;
    appendDebugLog(`parse-${source}`, {
      textLength: snapshot.textLength,
      trimmedLength: snapshot.trimmedLength,
      tabCount: snapshot.tabCount,
      parsedPhysicalRows: snapshot.parsedPhysicalRows,
      firstRowColumnCount: snapshot.firstRowColumnCount,
      detectedFormat: snapshot.detectedFormat,
      acceptedCount: snapshot.acceptedCount,
      rejectedCount: snapshot.rejectedCount,
      firstRow: snapshot.firstRow,
      headers: snapshot.headers,
      rejectedPreview: snapshot.rejectedPreview,
      textPreview: snapshot.textPreview
    });
    if (snapshot.textLength > 0 && snapshot.acceptedCount === 0) {
      console.warn("[AJANS][parse-debug] Veri var ama parse edilen sat\u0131r yok.", snapshot);
    }
    return snapshot;
  }
  function getRowsFromTextarea() {
    const textarea = $("#ajans-gider-textarea");
    if (!textarea) return [];
    return parseTable(textarea.value);
  }
  function getCurrentFlow() {
    return getPageDetectionSnapshot().flow;
  }
  function isBusy() {
    return isFilling || isRunningPayment;
  }
  function isPaymentFormOpen() {
    return Boolean($("[data-tns='add-payment']", getActiveAppDocument()));
  }
  function clearPaymentWaitIfFormClosed() {
    if (paymentAwaitingManualSave && !isPaymentFormOpen()) {
      paymentAwaitingManualSave = false;
    }
  }
  function getActiveRecords(flow = getCurrentFlow()) {
    const rows = getRowsFromTextarea();
    if (flow === "payment") {
      return { kind: "payment", items: getPaymentRecords(rows) };
    }
    return { kind: "expense", items: rows };
  }
  function advanceSelectionAfterSuccessfulFill(currentIndex, rowsLength) {
    if (currentIndex >= rowsLength - 1) return false;
    setSelectedIndex(currentIndex + 1);
    syncPanelRows();
    return true;
  }
  var FLOW_TITLES = {
    expense: "Gider Doldurucu",
    payment: "\xD6deme Doldurucu",
    idle: "Gider / \xD6deme Doldurucu"
  };
  var FLOW_HELP = {
    expense: "Excel sat\u0131rlar\u0131n\u0131 kopyalay\u0131p a\u015Fa\u011F\u0131ya yap\u0131\u015Ft\u0131r. Sayfa de\u011Fi\u015Fse de veri kal\u0131r.<br><b>S\xFCtunlar:</b> Ki\u015Fi \xB7 Marka \xB7 Tutar \xB7 Kay\u0131t \u0130smi<br>Se\xE7ili kayd\u0131 <b>Ana Gideri Doldur</b> ile forma yazar; kaydetmeyi sen yapars\u0131n.",
    payment: "Excel sat\u0131rlar\u0131n\u0131 kopyalay\u0131p a\u015Fa\u011F\u0131ya yap\u0131\u015Ft\u0131r. Sayfa de\u011Fi\u015Fse de veri kal\u0131r.<br><b>\xD6deme s\xFCtunlar\u0131:</b> \xD6deme Tutar\u0131 \xB7 \xD6deme Tarihi \xB7 \xD6deme Hesab\u0131<br>Birden fazla \xF6deme i\xE7in tutar/tarih/hesab\u0131 <b>/</b> ile ay\u0131r. <b>\xD6demeyi Ba\u015Flat</b> tedarik\xE7iyi bulup \xF6deme formunu doldurur; son <b>\xD6DEME EKLE</b>'ye sen basars\u0131n.",
    idle: "Excel sat\u0131rlar\u0131n\u0131 kopyalay\u0131p a\u015Fa\u011F\u0131ya yap\u0131\u015Ft\u0131r. Sayfa de\u011Fi\u015Fse de veri kal\u0131r.<br>Gider formuna gidince gider, tedarik\xE7i sayfas\u0131na gidince \xF6deme arac\u0131 \xE7\u0131kar."
  };
  function updateFlowVisibility(flow = getCurrentFlow()) {
    const expenseActions = $("#ajans-gider-expense-actions");
    const paymentActions = $("#ajans-gider-payment-actions");
    const titleText = $("#ajans-gider-title-text");
    const helpContent = $("#ajans-gider-help-content");
    if (expenseActions) {
      expenseActions.style.display = flow === "expense" ? "block" : "none";
    }
    if (paymentActions) {
      paymentActions.style.display = flow === "payment" ? "block" : "none";
    }
    if (titleText) {
      titleText.textContent = FLOW_TITLES[flow] || FLOW_TITLES.idle;
    }
    if (helpContent) {
      helpContent.innerHTML = FLOW_HELP[flow] || FLOW_HELP.idle;
    }
  }
  function applyDataEditorState() {
    const wrapper = $("#ajans-gider-textarea-wrapper");
    const collapsed = $("#ajans-gider-data-collapsed");
    const textarea = $("#ajans-gider-textarea");
    if (!wrapper || !collapsed || !textarea) return;
    const hasData = String(textarea.value || "").trim().length > 0;
    if (!hasData) {
      wrapper.hidden = false;
      collapsed.hidden = true;
      return;
    }
    if (isDataEditorOpen) {
      wrapper.hidden = false;
      collapsed.hidden = true;
    } else {
      wrapper.hidden = true;
      collapsed.hidden = false;
    }
  }
  function applyHelpState() {
    const help = $("#ajans-gider-help");
    if (!help) return;
    help.hidden = !isHelpOpen;
  }
  function setDataSummary(rowCount) {
    const summary = $("#ajans-gider-data-summary");
    if (!summary) return;
    if (rowCount > 0) {
      summary.textContent = `${rowCount} kay\u0131t haz\u0131r`;
    } else {
      summary.textContent = "Veri haz\u0131r";
    }
  }
  function setStepButtonsState(selectedIndex, rowsLength) {
    const prev = $("#ajans-gider-prev");
    const next = $("#ajans-gider-next");
    if (prev) {
      const disabled = rowsLength <= 1 || selectedIndex <= 0;
      prev.disabled = disabled;
      prev.style.opacity = disabled ? "0.4" : "1";
      prev.style.cursor = disabled ? "not-allowed" : "pointer";
    }
    if (next) {
      const disabled = rowsLength <= 1 || selectedIndex >= rowsLength - 1;
      next.disabled = disabled;
      next.style.opacity = disabled ? "0.4" : "1";
      next.style.cursor = disabled ? "not-allowed" : "pointer";
    }
  }
  function renderMetaChips(meta, chips) {
    if (!meta) return;
    meta.innerHTML = "";
    if (!chips.length) {
      meta.style.display = "none";
      return;
    }
    meta.style.display = "flex";
    chips.forEach(({ label, tone }) => {
      const span = document.createElement("span");
      span.textContent = label;
      span.style.cssText = tone === "accent" ? `
          padding:2px 8px;
          border-radius:999px;
          background:#e0ecff;
          color:#0f4fc1;
          font-size:11px;
          font-weight:600;
          line-height:1.6;
        ` : `
          padding:2px 8px;
          border-radius:999px;
          background:#f1f5f9;
          color:#475569;
          font-size:11px;
          font-weight:500;
          line-height:1.6;
        `;
      meta.appendChild(span);
    });
  }
  function renderRecordCard(item, kind, selectedIndex, total) {
    const empty = $("#ajans-gider-empty");
    const record = $("#ajans-gider-record");
    const supplier = $("#ajans-gider-supplier");
    const meta = $("#ajans-gider-meta");
    const amount = $("#ajans-gider-amount");
    const dates = $("#ajans-gider-dates");
    const title = $("#ajans-gider-title");
    if (!empty || !record) return;
    if (!item) {
      empty.hidden = false;
      record.hidden = true;
      return;
    }
    empty.hidden = true;
    record.hidden = false;
    if (supplier) {
      supplier.textContent = String(item.supplier || "Tedarik\xE7i yok").trim();
    }
    if (amount) {
      amount.textContent = `\u20BA ${formatAmountTR(item.amount)}`;
    }
    if (kind === "payment") {
      const chips2 = [];
      if (item.paymentCount > 1) {
        chips2.push({
          label: `\xD6deme ${item.paymentIndex + 1}/${item.paymentCount}`,
          tone: "accent"
        });
      }
      renderMetaChips(meta, chips2);
      if (dates) {
        const parts = [];
        if (item.date) parts.push(`Tarih: ${formatDateTR(item.date)}`);
        if (item.account) parts.push(`Hesap: ${String(item.account).trim()}`);
        dates.textContent = parts.join("  \xB7  ");
        dates.style.display = parts.length ? "block" : "none";
      }
      if (title) {
        const text = String(item.itemName || "").trim();
        title.textContent = text;
        title.title = text;
        title.style.display = text ? "-webkit-box" : "none";
      }
      setStepButtonsState(selectedIndex, total);
      return;
    }
    const chips = [];
    const brand = String(item.brand || "").trim();
    const tag = String(item.tag || "").trim();
    const rawBrand = item.rawBrand && item.rawBrand !== item.brand ? String(item.rawBrand).trim() : "";
    if (brand) chips.push({ label: brand, tone: "accent" });
    if (tag) chips.push({ label: tag, tone: "muted" });
    if (rawBrand) chips.push({ label: `Excel: ${rawBrand}`, tone: "muted" });
    renderMetaChips(meta, chips);
    if (dates) {
      const parts = [];
      if (item.issueDate) parts.push(`Fatura: ${formatDateTR(item.issueDate)}`);
      if (item.dueDate) parts.push(`\xD6deme: ${formatDateTR(item.dueDate)}`);
      dates.textContent = parts.join("  \xB7  ");
      dates.style.display = parts.length ? "block" : "none";
    }
    if (title) {
      const text = String(item.title || "").trim();
      title.textContent = text;
      title.title = text;
      title.style.display = text ? "-webkit-box" : "none";
    }
    setStepButtonsState(selectedIndex, total);
  }
  function syncPanelRows() {
    clearPaymentWaitIfFormClosed();
    const textarea = $("#ajans-gider-textarea");
    const select = $("#ajans-gider-row-select");
    if (!textarea) return;
    const flow = getCurrentFlow();
    updateFlowVisibility(flow);
    applyHelpState();
    let records = { kind: flow === "payment" ? "payment" : "expense", items: [] };
    let parseError = null;
    try {
      records = getActiveRecords(flow);
    } catch (err) {
      parseError = err;
    }
    const items = records.items;
    const kind = records.kind;
    if (parseError || String(textarea.value || "").trim() && !items.length) {
      logParseSnapshot("sync-empty", textarea.value);
    }
    if (select) {
      select.innerHTML = "";
      items.forEach((item, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        const supplier = String(item.supplier || "Tedarik\xE7i yok").trim();
        const shortSupplier = supplier.length > 24 ? `${supplier.slice(0, 24)}\u2026` : supplier;
        const amountText = `${formatAmountTR(item.amount)} TL`;
        const suffix = kind === "payment" && item.paymentCount > 1 ? `  \xB7  \xD6d. ${item.paymentIndex + 1}/${item.paymentCount}` : "";
        option.textContent = `${index + 1} / ${items.length}  \xB7  ${shortSupplier}  \xB7  ${amountText}${suffix}`;
        select.appendChild(option);
      });
    }
    setDataSummary(items.length);
    applyDataEditorState();
    if (parseError) {
      renderRecordCard(null, kind, 0, 0);
      if (!isBusy()) setStatus(String(parseError.message || parseError), true);
      return;
    }
    if (!items.length) {
      renderRecordCard(null, kind, 0, 0);
      if (isBusy()) return;
      if (flow === "expense") {
        setStatus("Gider formundas\u0131n. Veri yap\u0131\u015Ft\u0131r\u0131nca doldurulur.");
      } else if (flow === "payment") {
        const hasText = String(textarea.value || "").trim().length > 0;
        setStatus(
          hasText ? "\xD6deme kayd\u0131 yok. Excel'e \xD6deme Tutar\u0131 / Tarihi / Hesab\u0131 s\xFCtunlar\u0131n\u0131 ekle." : "Tedarik\xE7iler sayfas\u0131ndas\u0131n. Excel'i yap\u0131\u015Ft\u0131r\u0131nca \xF6demeleri ba\u015Flatabilirsin."
        );
      } else {
        setStatus("");
      }
      return;
    }
    const selectedIndex = getSelectedIndex(items.length);
    if (select) select.value = String(selectedIndex);
    renderRecordCard(items[selectedIndex], kind, selectedIndex, items.length);
    if (isBusy()) return;
    if (flow === "expense") {
      setStatus("");
    } else if (flow === "payment") {
      if (paymentAwaitingManualSave && isPaymentFormOpen()) {
        setStatus(
          '\xD6deme formu a\xE7\u0131k. Kontrol edip Para\u015F\xFCt i\xE7indeki son "\xD6DEME EKLE" butonuna manuel bas; form kapand\u0131ktan sonra \u203A ile devam et.',
          "success"
        );
        return;
      }
      setStatus("");
    } else {
      setStatus("Gider formu veya tedarik\xE7i sayfas\u0131na gidince bu kayd\u0131 kullanabilirsin.");
    }
  }
  function registerPanelEvents(panel) {
    const textarea = $("#ajans-gider-textarea");
    const select = $("#ajans-gider-row-select");
    const handle = $("#ajans-gider-drag-handle");
    const body = $("#ajans-gider-body");
    const minimizeButton = $("#ajans-gider-minimize");
    const helpButton = $("#ajans-gider-help-toggle");
    const editDataButton = $("#ajans-gider-edit-data");
    textarea.value = localStorage.getItem(STORAGE_TEXT_KEY) || "";
    installDebugHelpers();
    isDataEditorOpen = String(textarea.value || "").trim().length === 0;
    isHelpOpen = false;
    makePanelDraggable(panel, handle);
    applyMinimizedState(panel, body, minimizeButton);
    textarea.addEventListener("paste", (event) => {
      const pastedText = event.clipboardData?.getData("text/plain") || "";
      const htmlText = event.clipboardData?.getData("text/html") || "";
      const clipboardTypes = Array.from(event.clipboardData?.types || []);
      appendDebugLog("textarea-paste", {
        clipboardTypes,
        pastedTextLength: pastedText.length,
        pastedHtmlLength: htmlText.length,
        pastedTabCount: (pastedText.match(/\t/g) || []).length,
        pastedLineCount: pastedText ? pastedText.replace(/\r\n/g, "\n").split("\n").length : 0,
        pastedPreview: pastedText.slice(0, 500)
      });
      window.setTimeout(() => {
        logParseSnapshot("paste-after-input", textarea.value, { force: true });
      }, 0);
    });
    textarea.addEventListener("input", () => {
      localStorage.setItem(STORAGE_TEXT_KEY, textarea.value);
      setSelectedIndex(0);
      isDataEditorOpen = true;
      logParseSnapshot("input", textarea.value, { force: true });
      syncPanelRows();
    });
    textarea.addEventListener("focus", () => {
      textarea.style.borderColor = "#1f6feb";
    });
    textarea.addEventListener("blur", () => {
      textarea.style.borderColor = "#e5e7eb";
      if (String(textarea.value || "").trim().length > 0) {
        isDataEditorOpen = false;
        applyDataEditorState();
      }
    });
    if (select) {
      select.addEventListener("change", () => {
        setSelectedIndex(Number(select.value || 0));
        syncPanelRows();
      });
    }
    if (helpButton) {
      helpButton.addEventListener("click", () => {
        isHelpOpen = !isHelpOpen;
        applyHelpState();
      });
    }
    if (editDataButton) {
      editDataButton.addEventListener("click", () => {
        isDataEditorOpen = true;
        applyDataEditorState();
        const ta = $("#ajans-gider-textarea");
        if (ta) ta.focus();
      });
    }
    $("#ajans-gider-prev").addEventListener("click", () => {
      const count = getActiveRecords().items.length;
      if (!count) return;
      const current = getSelectedIndex(count);
      setSelectedIndex(Math.max(0, current - 1));
      syncPanelRows();
    });
    $("#ajans-gider-next").addEventListener("click", () => {
      const count = getActiveRecords().items.length;
      if (!count) return;
      const current = getSelectedIndex(count);
      setSelectedIndex(Math.min(count - 1, current + 1));
      syncPanelRows();
    });
    $("#ajans-gider-clear").addEventListener("click", () => {
      textarea.value = "";
      localStorage.removeItem(STORAGE_TEXT_KEY);
      clearSelectionState();
      isDataEditorOpen = true;
      syncPanelRows();
      setStatus("Veri temizlendi.");
    });
    $("#ajans-gider-fill").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (isFilling) return;
      isFilling = true;
      setFillButtonLoading(button, true);
      try {
        const rows = getRowsFromTextarea();
        if (!rows.length) throw new Error("Sat\u0131r bulunamad\u0131.");
        const index = getSelectedIndex(rows.length);
        const row = rows[index];
        setStatus(`${index + 1}. kay\u0131t dolduruluyor...`);
        await fillExpense(row);
        const advanced = advanceSelectionAfterSuccessfulFill(index, rows.length);
        const nextMessage = advanced ? ` ${index + 2}. kayda ge\xE7ildi.` : " Son kay\u0131ttas\u0131n.";
        setStatus(
          `DOLDURMA BA\u015EARILI. ${index + 1}. kay\u0131t forma dolduruldu.${nextMessage} Kaydetme i\u015Flemini manuel yap.`,
          "success"
        );
      } catch (err) {
        console.error("[AJANS] Doldurma hatas\u0131:", err);
        setStatus(err.message || String(err), true);
      } finally {
        isFilling = false;
        setFillButtonLoading(button, false);
      }
    });
    $("#ajans-gider-pay").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (isRunningPayment) return;
      isRunningPayment = true;
      setPayButtonLoading(button, true);
      try {
        clearPaymentWaitIfFormClosed();
        if (paymentAwaitingManualSave && isPaymentFormOpen()) {
          throw new Error(
            'A\xE7\u0131k \xF6deme formu var. \xD6nce kontrol edip Para\u015F\xFCt i\xE7indeki son "\xD6DEME EKLE" butonuna manuel bas, form kapand\u0131ktan sonra sonraki \xF6demeye ge\xE7.'
          );
        }
        const records = getActiveRecords("payment").items;
        if (!records.length) {
          throw new Error(
            "\xD6deme kayd\u0131 bulunamad\u0131. Excel'e \xD6deme Tutar\u0131 / Tarihi / Hesab\u0131 s\xFCtunlar\u0131n\u0131 ekledin mi?"
          );
        }
        const index = getSelectedIndex(records.length);
        const record = records[index];
        setStatus(`${index + 1}. \xF6deme i\u015Fleniyor...`);
        await runPayment(record, (message) => setStatus(message));
        paymentAwaitingManualSave = true;
        setStatus(
          `\xD6deme formu dolduruldu (${index + 1}/${records.length}). Kontrol edip "\xD6DEME EKLE"ye bas, sonra \u203A ile sonraki \xF6demeye ge\xE7.`,
          "success"
        );
      } catch (err) {
        console.error("[AJANS] \xD6deme hatas\u0131:", err);
        setStatus(err.message || String(err), true);
      } finally {
        isRunningPayment = false;
        setPayButtonLoading(button, false);
      }
    });
    minimizeButton.addEventListener("click", () => {
      const current = body.style.display === "none";
      setPanelMinimized(!current);
      applyMinimizedState(panel, body, minimizeButton);
      savePanelPosition(panel);
    });
    syncPanelRows();
  }
  function injectPanel() {
    if (!document.body) return;
    removeDuplicatePanels();
    if ($(`#${PANEL_ID}`)) return;
    const panel = createPanelElement();
    document.body.appendChild(panel);
    registerPanelEvents(panel);
    console.log("[AJANS] Gider paneli eklendi:", location.href);
    appendDebugLog("panel-injected", {
      snapshot: getPageDetectionSnapshot()
    });
  }
  function removePanel(reason = "unknown", snapshot = getPageDetectionSnapshot()) {
    const panels = document.querySelectorAll(`#${PANEL_ID}`);
    if (panels.length) {
      appendDebugLog("panel-remove-requested", {
        reason,
        panelCount: panels.length,
        snapshot
      });
    }
    panels.forEach((panel) => panel.remove());
  }
  function ensurePanelForCurrentPage(reason = "refresh") {
    const snapshot = getPageDetectionSnapshot();
    const flow = snapshot.flow;
    const decisionLogKey = [
      reason,
      flow,
      snapshot.pathname,
      snapshot.activeDocumentPathname,
      Boolean($(`#${PANEL_ID}`))
    ].join("|");
    if (decisionLogKey !== lastDecisionLogKey) {
      appendDebugLog("panel-decision", {
        reason,
        flow,
        snapshot
      });
      lastDecisionLogKey = decisionLogKey;
    }
    if (flow === "idle") {
      if (isBusy()) return flow;
      removePanel("idle-flow", snapshot);
      return flow;
    }
    injectPanel();
    syncPanelRows();
    return flow;
  }
  function keepPanelInViewport() {
    const panel = $(`#${PANEL_ID}`);
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const safeLeft = Math.max(0, Math.min(rect.left, window.innerWidth - 80));
    const safeTop = Math.max(0, Math.min(rect.top, window.innerHeight - 50));
    panel.style.left = `${safeLeft}px`;
    panel.style.top = `${safeTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    savePanelPosition(panel);
  }

  // src/main.js
  var ROUTE_REFRESH_EVENT = "ajans:route-refresh";
  if (!shouldRunInThisFrame()) {
    console.info("[AJANS] D\u0131\u015F Trinity kabu\u011Funda \xE7al\u0131\u015Ft\u0131r\u0131lmad\u0131.");
  } else if (window.__AJANS_GIDER_SCRIPT_LOADED__) {
    console.warn("[AJANS] Script zaten y\xFCklenmi\u015F, ikinci \xE7al\u0131\u015Fma engellendi.");
    removeDuplicatePanels();
  } else {
    window.__AJANS_GIDER_SCRIPT_LOADED__ = true;
    removeDuplicatePanels();
    const refreshPanel = (reason = "refresh") => {
      if (!shouldRunInThisFrame()) {
        removePanel("wrong-frame");
        return;
      }
      ensurePanelForCurrentPage(reason);
    };
    const scheduleRefreshPanel = (reason = "scheduled") => {
      window.setTimeout(() => refreshPanel(`${reason}:0ms`), 0);
      window.setTimeout(() => refreshPanel(`${reason}:300ms`), 300);
      window.setTimeout(() => refreshPanel(`${reason}:1000ms`), 1e3);
    };
    const patchHistoryMethod = (methodName) => {
      const original = window.history[methodName];
      if (typeof original !== "function") return;
      window.history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new CustomEvent(ROUTE_REFRESH_EVENT, {
          detail: { methodName }
        }));
        return result;
      };
    };
    const watchSpaNavigation = () => {
      patchHistoryMethod("pushState");
      patchHistoryMethod("replaceState");
      window.addEventListener("popstate", () => scheduleRefreshPanel("popstate"));
      window.addEventListener("hashchange", () => scheduleRefreshPanel("hashchange"));
      window.addEventListener(
        ROUTE_REFRESH_EVENT,
        (event) => scheduleRefreshPanel(`history:${event.detail?.methodName || "unknown"}`)
      );
      const observer = new MutationObserver(() => {
        if (!document.body || document.querySelector("#ajans-gider-panel")) return;
        scheduleRefreshPanel("panel-missing-after-dom-mutation");
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    };
    const boot = () => {
      console.log("[AJANS] Script \xE7al\u0131\u015Ft\u0131:", location.href);
      refreshPanel("boot");
      watchSpaNavigation();
      window.addEventListener("resize", keepPanelInViewport);
      window.setInterval(() => refreshPanel("interval"), 1500);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})();
