// ==UserScript==
// @name         Parasut Gider Formu Excel Doldurucu
// @namespace    ajans-parasut
// @version      1.2.12
// @description  Excel satırlarından seçilen kaydı Paraşüt gider formuna manuel doldurur
// @match        https://uygulama.parasut.com/*
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
  var STORAGE_PAYMENT_INDEX_KEY = "ajans-gider-selected-payment-index-v1";
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
    const trDatePattern = new RegExp(
      "^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})$"
    );
    const isoDatePattern = new RegExp("^(\\d{4})-(\\d{1,2})-(\\d{1,2})$");
    if (excelDatePattern.test(raw)) {
      const d = new Date(1899, 11, 30);
      d.setDate(d.getDate() + Number(raw));
      return d;
    }
    const tr = raw.match(trDatePattern);
    if (tr) {
      return new Date(Number(tr[3]), Number(tr[2]) - 1, Number(tr[1]));
    }
    const iso = raw.match(isoDatePattern);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
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

  // src/core/paymentParser.js
  function parsePaymentItems(row) {
    const lines = String(row?.title || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const amountAtEndPattern = /^(.*?)\s*[-–—]\s*([\d.,]+)\s*(?:TL|TRY|₺)?\s*$/i;
    const items = lines.map((line) => {
      const match = line.match(amountAtEndPattern);
      if (!match) return null;
      return {
        description: match[1].trim(),
        amount: parseAmount(match[2]),
        raw: line
      };
    }).filter((item) => item && item.amount > 0);
    if (items.length) return items;
    const fallbackAmount = parseAmount(row?.amount);
    if (!fallbackAmount) return [];
    return [
      {
        description: String(row?.title || row?.brand || "\xD6deme").trim(),
        amount: fallbackAmount,
        raw: String(row?.title || "").trim()
      }
    ];
  }
  function paymentItemsTotal(items) {
    return items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
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
  function pick(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== void 0 && String(obj[key]).trim() !== "") {
        return obj[key];
      }
    }
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
    const firstRowKeys = rows[0].map(keyify);
    const hasHeader = firstRowKeys.some(
      (key) => [
        "toplam_tutar",
        "toplam",
        "tutar",
        "kisi",
        "tedarikci",
        "kayit_ismi",
        "aciklama",
        "kalem",
        "kalemler",
        "marka",
        "fis_fatura_tarihi",
        "fatura_tarihi",
        "odenecegi_tarih",
        "odeme_tarihi",
        "etiket"
      ].includes(key)
    );
    const headers = hasHeader ? rows.shift().map(keyify) : [
      "toplam_tutar",
      "kisi",
      "kayit_ismi",
      "marka",
      "fis_fatura_tarihi",
      "odenecegi_tarih",
      "etiket"
    ];
    return rows.map((cols) => {
      const raw = {};
      headers.forEach((h, i) => {
        raw[h] = cols[i] || "";
      });
      const amount = pick(raw, ["toplam_tutar", "toplam", "tutar", "amount"]);
      const supplier = pick(raw, ["kisi", "tedarikci", "tedarikci_adi"]);
      const title = pick(raw, [
        "kayit_ismi",
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
      return {
        amount,
        supplier,
        title,
        brand,
        tag,
        issueDate: parseDate(issueDateRaw) || /* @__PURE__ */ new Date(),
        dueDate: parseDate(dueDateRaw) || nextPaymentDate()
      };
    }).filter((row) => {
      const amountNumber = parseAmount(row.amount);
      if (!amountNumber) return false;
      if (!row.supplier && !row.title && !row.brand) return false;
      return true;
    });
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
    el.dispatchEvent(new view.KeyboardEvent("keyup", { bubbles: true }));
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
  function getVisibleDropdownRoots(root = getActiveAppDocument()) {
    const roots = $$(
      ".dropdownContent, .ember-basic-dropdown-content, .ember-power-select-dropdown, [role='listbox']",
      root
    ).filter(isVisible);
    return roots.length ? roots : [root];
  }
  function findVisibleActionByText(text, options = {}) {
    const wanted = norm(text);
    const selector = options.selector || "button, a";
    const root = options.root || getActiveAppDocument();
    return $$(selector, root).filter(isVisible).find((el) => {
      if (options.excludeSave && el.getAttribute("data-tid") === "save") {
        return false;
      }
      return norm(elementText(el)) === wanted;
    });
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
      setNativeValue(searchInput, value);
      await sleep(800);
    }
    const candidates = [];
    for (const root of getVisibleDropdownRoots()) {
      candidates.push(
        ...$$(
          "[data-tid='select-category'], [data-tid='toggleTag'], .ember-power-select-option, li a, a, button",
          root
        ).filter(isVisible)
      );
    }
    const exact = candidates.find((el) => {
      const title = el.querySelector("[title]")?.getAttribute("title") || el.getAttribute("title") || elementText(el);
      return norm(title) === norm(value);
    });
    const partial = candidates.find((el) => {
      const title = el.querySelector("[title]")?.getAttribute("title") || el.getAttribute("title") || elementText(el);
      return norm(title).includes(norm(value));
    });
    const selected = exact || partial;
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
  function getAppPathname() {
    const currentPathname = getWindowPathname(window);
    const topPathname = getWindowPathname(window.top);
    const iframePathnames = getTrinityIframePathnames();
    return [currentPathname, topPathname, ...iframePathnames].find(
      (pathname) => /\/fis-faturalar(?:\/|$)/.test(pathname)
    ) || iframePathnames[0] || topPathname || currentPathname || location.pathname;
  }
  function hasVisiblePaymentForm(root) {
    return $$("[data-tns='add-payment']", root).some(isVisible);
  }
  function matchesExpenseFormPath(pathname) {
    return /\/fis-faturalar\/yeni(?:\/hizli)?\/?$/.test(pathname);
  }
  function matchesPurchaseBillShowPath(pathname) {
    return /\/fis-faturalar\/\d+(?:\/.*)?\/?$/.test(pathname);
  }
  function getPageDetectionSnapshot(root = getActiveAppDocument()) {
    const pathname = getAppPathname();
    const hasRecordId = Boolean(
      $("input[data-tid='record-id'][data-ttype='page']", root)
    );
    const hasPurchaseBillShow = Boolean($("[data-tns='purchase-bills-show']", root));
    const hasPaymentForm = hasVisiblePaymentForm(root);
    const isExpense = matchesExpenseFormPath(pathname);
    const isPurchase = matchesPurchaseBillShowPath(pathname) || /\/fis-faturalar(?:\/|$)/.test(pathname) && (hasRecordId || hasPurchaseBillShow || hasPaymentForm);
    return {
      href: location.href,
      pathname,
      currentPathname: getWindowPathname(window),
      topPathname: getWindowPathname(window.top),
      iframePathnames: getTrinityIframePathnames(),
      activeDocumentPathname: getWindowPathname(root.defaultView),
      hasRecordId,
      hasPurchaseBillShow,
      hasPaymentForm,
      isExpense,
      isPurchase,
      flow: isExpense ? "expense" : isPurchase ? "payment" : "idle"
    };
  }
  function isExpenseFormPage() {
    return getPageDetectionSnapshot().isExpense;
  }
  function isPurchaseBillShowPage(root = getActiveAppDocument()) {
    return getPageDetectionSnapshot(root).isPurchase;
  }

  // src/parasut/supplier.js
  async function fillSupplier(name) {
    if (!name) return;
    const input = findInputByLabels(["TEDAR\u0130K\xC7\u0130", "K\u0130\u015E\u0130", "CAR\u0130", "F\u0130RMA"]);
    if (!input) throw new Error("Tedarik\xE7i alan\u0131 bulunamad\u0131.");
    setNativeValue(input, name, { blur: false });
    const firstOption = await waitFor(() => {
      const options = $$(
        ".ember-power-select-option, .tt-suggestion, [data-test-option], .autocomplete-result, [role='option'], li a",
        input.ownerDocument
      ).filter(isVisible);
      return options[0] || null;
    }, 3500).catch(() => null);
    if (!firstOption) {
      throw new Error(`Tedarik\xE7i se\xE7ene\u011Fi bulunamad\u0131: ${name}`);
    }
    input.focus();
    sendKey(input, "Enter");
    await sleep(500);
  }

  // src/parasut/expenseFlow.js
  function selectUnpaid() {
    const root = getActiveAppDocument();
    const unpaidRadio = $("input[name='paymentStatus'][value='unpaid']", root) || $$("label", root).find((label) => norm(elementText(label)).includes("\xD6DENECEK"))?.querySelector("input[type='radio']");
    if (unpaidRadio && !unpaidRadio.checked) {
      unpaidRadio.click();
      unpaidRadio.dispatchEvent(new Event("change", { bubbles: true }));
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
    setRequiredField(
      ["F\u0130\u015E/FATURA TAR\u0130H\u0130", "FATURA TAR\u0130H\u0130", "F\u0130\u015E TAR\u0130H\u0130", "TAR\u0130H"],
      formatDateTR(row.issueDate),
      "Fi\u015F/Fatura tarihi"
    );
    setRequiredField(
      ["TOPLAM TUTAR", "GENEL TOPLAM", "TUTAR"],
      formatAmountTR(row.amount),
      "Toplam tutar"
    );
    setOptionalField(["TOPLAM KDV", "KDV"], "0,00");
    selectUnpaid();
    setOptionalField(
      ["\xD6DENECE\u011E\u0130 TAR\u0130H", "\xD6DEME TAR\u0130H\u0130", "VADE TAR\u0130H\u0130"],
      formatDateTR(row.dueDate)
    );
    await selectCategory(row.brand);
    if (row.tag) {
      await selectTag(row.tag);
    }
  }

  // src/parasut/frame.js
  function isIframe() {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }
  function shouldRunInThisFrame() {
    return !isIframe();
  }
  function removeDuplicatePanels() {
    $$(`#${PANEL_ID}`).forEach((panel, index) => {
      if (index > 0) panel.remove();
    });
  }

  // src/parasut/paymentFlow.js
  function findPaymentForm() {
    return $$("[data-tns='add-payment']").find(isVisible) || null;
  }
  function findPaymentFieldInput(fieldNames) {
    const wantedNames = (Array.isArray(fieldNames) ? fieldNames : [fieldNames]).map(
      norm
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
        "\xD6deme eklemek i\xE7in olu\u015Fturulan fi\u015F/fatura detay sayfas\u0131nda olmal\u0131s\u0131n."
      );
    }
    const button = findVisibleActionByText("\xD6DEME EKLE", {
      selector: "button",
      excludeSave: true
    });
    if (!button) throw new Error("\xDCstteki \xD6DEME EKLE butonu bulunamad\u0131.");
    button.click();
    return waitFor(() => findPaymentForm(), 5e3);
  }
  async function fillPayment(item) {
    if (!item) throw new Error("\xD6deme kalemi se\xE7ilmedi.");
    await openPaymentForm();
    const amountInput = await waitFor(
      () => findPaymentFieldInput(["MEBLA\u011E", "TUTAR"]),
      4e3
    );
    const descriptionInput = findPaymentFieldInput(["A\xC7IKLAMA"]);
    setNativeValue(amountInput, formatAmountTR(item.amount));
    if (descriptionInput) {
      setNativeValue(descriptionInput, item.description || item.raw || "\xD6deme");
    }
    await sleep(300);
  }

  // src/panel/storage.js
  function getSavedPanelPosition() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_POS_KEY) || "null");
    } catch {
      return null;
    }
  }
  function savePanelPosition(panel) {
    const rect = panel.getBoundingClientRect();
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
  function getSelectedPaymentIndex(itemsLength) {
    const raw = Number(localStorage.getItem(STORAGE_PAYMENT_INDEX_KEY) || 0);
    if (!Number.isFinite(raw)) return 0;
    if (raw < 0) return 0;
    if (raw >= itemsLength) return Math.max(0, itemsLength - 1);
    return raw;
  }
  function setSelectedPaymentIndex(index) {
    localStorage.setItem(STORAGE_PAYMENT_INDEX_KEY, String(index));
  }
  function clearSelectionState() {
    localStorage.removeItem(STORAGE_INDEX_KEY);
    localStorage.removeItem(STORAGE_PAYMENT_INDEX_KEY);
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
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
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
      panel.style.left = `${startLeft}px`;
      panel.style.top = `${startTop}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      document.body.style.userSelect = "none";
      event.preventDefault();
    });
    window.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      const nextLeft = startLeft + event.clientX - startX;
      const nextTop = startTop + event.clientY - startY;
      const maxLeft = window.innerWidth - 80;
      const maxTop = window.innerHeight - 50;
      panel.style.left = `${Math.max(0, Math.min(nextLeft, maxLeft))}px`;
      panel.style.top = `${Math.max(0, Math.min(nextTop, maxTop))}px`;
    });
    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      savePanelPosition(panel);
    });
  }

  // src/panel/view.js
  function createPanelElement() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    const savedPos = getSafePanelPosition();
    panel.style.cssText = `
      position: fixed;
      ${savedPos ? `left:${savedPos.left}px; top:${savedPos.top}px;` : "right:24px; top:110px;"}
      width: 480px;
      z-index: 2147483647;
      background: white;
      border: 3px solid #1f6feb;
      border-radius: 12px;
      padding: 0;
      box-shadow: 0 20px 60px rgba(0,0,0,.35);
      font-family: Arial, sans-serif;
      color: #111;
      overflow: hidden;
    `;
    panel.innerHTML = `
      <div id="ajans-gider-drag-handle" style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        background:#1f6feb;
        color:white;
        cursor:move;
      ">
        <div style="font-weight:700; font-size:15px;">Ajans Gider Doldurucu</div>
        <button id="ajans-gider-minimize" style="
          border:0;
          background:white;
          color:#1f6feb;
          border-radius:6px;
          padding:5px 8px;
          cursor:pointer;
          font-weight:700;
        ">K\xFC\xE7\xFClt</button>
      </div>

      <div id="ajans-gider-body" style="padding:14px;">
        <div style="font-size:12px; color:#555; margin-bottom:8px; line-height:1.4;">
          Excel'den t\xFCm sat\u0131rlar\u0131 tek seferde yap\u0131\u015Ft\u0131r. Sayfa de\u011Fi\u015Ftirsen de veri burada kal\u0131r.
          <br>
          Header yoksa s\u0131ra:
          <br>
          <b>TOPLAM TUTAR, K\u0130\u015E\u0130, KAYIT \u0130SM\u0130, MARKA, TAR\u0130H, \xD6DENECE\u011E\u0130 TAR\u0130H, ET\u0130KET</b>
        </div>

        <textarea id="ajans-gider-textarea" style="
          width:100%;
          height:120px;
          box-sizing:border-box;
          font-family:monospace;
          font-size:12px;
          padding:8px;
          border:1px solid #ccc;
          border-radius:8px;
          resize:vertical;
        "></textarea>

        <div style="margin-top:8px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Doldurulacak kay\u0131t</label>
          <select id="ajans-gider-row-select" style="
            width:100%;
            height:34px;
            border:1px solid #ccc;
            border-radius:8px;
            padding:6px;
            box-sizing:border-box;
            background:white;
          "></select>
        </div>

        <div id="ajans-gider-payment-section" style="margin-top:8px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">\xD6deme kalemi</label>
          <select id="ajans-gider-payment-select" style="
            width:100%;
            height:34px;
            border:1px solid #ccc;
            border-radius:8px;
            padding:6px;
            box-sizing:border-box;
            background:white;
          "></select>
        </div>

        <div id="ajans-gider-preview" style="
          margin-top:8px;
          padding:8px;
          background:#f6f8fa;
          border-radius:8px;
          font-size:12px;
          white-space:pre-wrap;
          min-height:70px;
          max-height:150px;
          overflow:auto;
        ">Veriyi yap\u0131\u015Ft\u0131r\u0131nca burada kay\u0131t listesi \xE7\u0131kacak.</div>

        <div id="ajans-gider-status" style="
          margin-top:8px;
          font-size:12px;
          color:#555;
        ">Haz\u0131r.</div>

        <div id="ajans-gider-payment-actions" style="margin-top:10px;">
          <button id="ajans-gider-fill-payment" style="
            width:100%;
            padding:9px 12px;
            background:#b42318;
            color:white;
            border:0;
            border-radius:6px;
            font-weight:700;
            cursor:pointer;
          ">Se\xE7ili \xD6deme Kalemini Doldur</button>
        </div>

        <div style="display:flex; gap:8px; justify-content:space-between; margin-top:10px;">
          <div style="display:flex; gap:8px;">
            <button id="ajans-gider-prev" style="
              padding:8px 10px;
              background:#eee;
              color:#111;
              border:0;
              border-radius:6px;
              font-weight:700;
              cursor:pointer;
            ">\xD6nceki</button>

            <button id="ajans-gider-next" style="
              padding:8px 10px;
              background:#eee;
              color:#111;
              border:0;
              border-radius:6px;
              font-weight:700;
              cursor:pointer;
            ">Sonraki</button>
          </div>

          <div style="display:flex; gap:8px;">
            <button id="ajans-gider-clear" style="
              padding:8px 10px;
              background:#ddd;
              color:#111;
              border:0;
              border-radius:6px;
              font-weight:700;
              cursor:pointer;
            ">Temizle</button>

            <div id="ajans-gider-expense-actions">
              <button id="ajans-gider-fill" style="
                padding:8px 12px;
                background:#111;
                color:white;
                border:0;
                border-radius:6px;
                font-weight:700;
                cursor:pointer;
              ">Ana Gideri Doldur</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return panel;
  }
  function setStatus(message, isError = false) {
    const status = $("#ajans-gider-status");
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? "#b42318" : "#555";
  }
  function setFillButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Dolduruluyor..." : "Ana Gideri Doldur";
    button.style.opacity = loading ? "0.65" : "1";
    button.style.cursor = loading ? "not-allowed" : "pointer";
  }
  function setPaymentButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "\xD6deme Haz\u0131rlan\u0131yor..." : "Se\xE7ili \xD6deme Kalemini Doldur";
    button.style.opacity = loading ? "0.65" : "1";
    button.style.cursor = loading ? "not-allowed" : "pointer";
  }
  function applyMinimizedState(panel, body, button) {
    const minimized = isPanelMinimized();
    body.style.display = minimized ? "none" : "block";
    button.textContent = minimized ? "A\xE7" : "K\xFC\xE7\xFClt";
    panel.style.width = minimized ? "300px" : "480px";
  }

  // src/panel/controller.js
  var isFilling = false;
  var lastDecisionLogKey = "";
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
  function getRowsFromTextarea() {
    const textarea = $("#ajans-gider-textarea");
    if (!textarea) return [];
    return parseTable(textarea.value);
  }
  function getCurrentFlow() {
    return getPageDetectionSnapshot().flow;
  }
  function updateFlowVisibility(flow = getCurrentFlow()) {
    const paymentSection = $("#ajans-gider-payment-section");
    const paymentActions = $("#ajans-gider-payment-actions");
    const expenseActions = $("#ajans-gider-expense-actions");
    if (paymentSection) {
      paymentSection.style.display = flow === "payment" ? "block" : "none";
    }
    if (paymentActions) {
      paymentActions.style.display = flow === "payment" ? "block" : "none";
    }
    if (expenseActions) {
      expenseActions.style.display = flow === "expense" ? "block" : "none";
    }
  }
  function syncPanelRows() {
    const textarea = $("#ajans-gider-textarea");
    const select = $("#ajans-gider-row-select");
    const paymentSelect = $("#ajans-gider-payment-select");
    const preview = $("#ajans-gider-preview");
    if (!textarea || !select || !paymentSelect || !preview) return;
    const flow = getCurrentFlow();
    updateFlowVisibility(flow);
    let rows = [];
    try {
      rows = parseTable(textarea.value);
    } catch (err) {
      select.innerHTML = "";
      preview.textContent = String(err.message || err);
      setStatus("Veri okunamad\u0131.", true);
      return;
    }
    select.innerHTML = "";
    if (!rows.length) {
      paymentSelect.innerHTML = "";
      preview.textContent = "Veriyi yap\u0131\u015Ft\u0131r\u0131nca burada kay\u0131t listesi \xE7\u0131kacak.";
      setStatus(
        flow === "expense" ? "Gider formundas\u0131n. Veri yap\u0131\u015Ft\u0131r\u0131nca ana gideri doldurabilirsin." : flow === "payment" ? "Fi\u015F/fatura detay\u0131ndas\u0131n. Veri yap\u0131\u015Ft\u0131r\u0131nca \xF6deme kalemini haz\u0131rlayabilirsin." : "Popup haz\u0131r. Gider formuna veya fi\u015F/fatura detay\u0131na gidince ilgili i\u015Flem g\xF6r\xFCn\xFCr."
      );
      return;
    }
    const selectedIndex = getSelectedIndex(rows.length);
    rows.forEach((row, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const title = String(row.title || "Kay\u0131t ismi yok").replace(/\s+/g, " ").trim();
      const shortTitle = title.length > 65 ? `${title.slice(0, 65)}...` : title;
      option.textContent = `${index + 1}. ${row.supplier || "Tedarik\xE7i yok"} | ${row.brand || "Kategori yok"} | ${formatAmountTR(
        row.amount
      )} TL | ${shortTitle}`;
      select.appendChild(option);
    });
    select.value = String(selectedIndex);
    const selected = rows[selectedIndex];
    const paymentItems = parsePaymentItems(selected);
    const selectedPaymentIndex = getSelectedPaymentIndex(paymentItems.length);
    const selectedPayment = paymentItems[selectedPaymentIndex];
    const parsedPaymentTotal = paymentItemsTotal(paymentItems);
    const rowAmount = parseAmount(selected.amount);
    const paymentTotalMismatch = paymentItems.length > 1 && Math.abs(parsedPaymentTotal - rowAmount) >= 0.01;
    paymentSelect.innerHTML = "";
    paymentItems.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const description = String(item.description || "\xD6deme").replace(/\s+/g, " ").trim();
      const shortDescription = description.length > 58 ? `${description.slice(0, 58)}...` : description;
      option.textContent = `${index + 1}. ${formatAmountTR(
        item.amount
      )} TL | ${shortDescription}`;
      paymentSelect.appendChild(option);
    });
    paymentSelect.value = String(selectedPaymentIndex);
    paymentSelect.disabled = paymentItems.length <= 1;
    const previewLines = [
      `Se\xE7ili kay\u0131t: ${selectedIndex + 1} / ${rows.length}`,
      `Tedarik\xE7i: ${selected.supplier || "-"}`,
      `Kategori / Marka: ${selected.brand || "-"}`,
      `Tutar: ${formatAmountTR(selected.amount)} TL`,
      `Fi\u015F/Fatura tarihi: ${formatDateTR(selected.issueDate)}`,
      `\xD6denece\u011Fi tarih: ${formatDateTR(selected.dueDate)}`,
      `Etiket: ${selected.tag || "-"}`
    ];
    if (flow === "payment") {
      previewLines.push(
        `\xD6deme kalemi: ${selectedPayment ? `${selectedPaymentIndex + 1} / ${paymentItems.length} - ${formatAmountTR(
          selectedPayment.amount
        )} TL` : "bulunamad\u0131"}`
      );
      if (paymentTotalMismatch) {
        previewLines.push(
          `Uyar\u0131: Alt \xF6deme toplam\u0131 ${formatAmountTR(
            parsedPaymentTotal
          )} TL, ana tutar ${formatAmountTR(rowAmount)} TL.`
        );
      }
    }
    preview.textContent = [
      ...previewLines,
      "",
      selected.title || "Kay\u0131t ismi yok"
    ].join("\n");
    setStatus(
      flow === "expense" ? "Gider formundas\u0131n. Bu ekranda sadece ana gider giri\u015Fi yap\u0131l\u0131r." : flow === "payment" ? "Fi\u015F/fatura detay\u0131ndas\u0131n. Bu ekranda sadece \xF6deme kalemi haz\u0131rlan\u0131r." : "Popup haz\u0131r. Gider formuna gidince se\xE7ili kayd\u0131 doldurabilirsin."
    );
  }
  function registerPanelEvents(panel) {
    const textarea = $("#ajans-gider-textarea");
    const select = $("#ajans-gider-row-select");
    const paymentSelect = $("#ajans-gider-payment-select");
    const handle = $("#ajans-gider-drag-handle");
    const body = $("#ajans-gider-body");
    const minimizeButton = $("#ajans-gider-minimize");
    textarea.value = localStorage.getItem(STORAGE_TEXT_KEY) || "";
    makePanelDraggable(panel, handle);
    applyMinimizedState(panel, body, minimizeButton);
    textarea.addEventListener("input", () => {
      localStorage.setItem(STORAGE_TEXT_KEY, textarea.value);
      setSelectedIndex(0);
      syncPanelRows();
    });
    select.addEventListener("change", () => {
      setSelectedIndex(Number(select.value || 0));
      setSelectedPaymentIndex(0);
      syncPanelRows();
    });
    paymentSelect.addEventListener("change", () => {
      setSelectedPaymentIndex(Number(paymentSelect.value || 0));
      syncPanelRows();
    });
    $("#ajans-gider-prev").addEventListener("click", () => {
      const rows = getRowsFromTextarea();
      if (!rows.length) return;
      const current = getSelectedIndex(rows.length);
      setSelectedIndex(Math.max(0, current - 1));
      setSelectedPaymentIndex(0);
      syncPanelRows();
    });
    $("#ajans-gider-next").addEventListener("click", () => {
      const rows = getRowsFromTextarea();
      if (!rows.length) return;
      const current = getSelectedIndex(rows.length);
      setSelectedIndex(Math.min(rows.length - 1, current + 1));
      setSelectedPaymentIndex(0);
      syncPanelRows();
    });
    $("#ajans-gider-clear").addEventListener("click", () => {
      textarea.value = "";
      localStorage.removeItem(STORAGE_TEXT_KEY);
      clearSelectionState();
      syncPanelRows();
      setStatus("Veri temizlendi.");
    });
    $("#ajans-gider-fill-payment").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (isFilling) return;
      isFilling = true;
      setPaymentButtonLoading(button, true);
      try {
        const rows = getRowsFromTextarea();
        if (!rows.length) throw new Error("Sat\u0131r bulunamad\u0131.");
        const rowIndex = getSelectedIndex(rows.length);
        const row = rows[rowIndex];
        const paymentItems = parsePaymentItems(row);
        const paymentIndex = getSelectedPaymentIndex(paymentItems.length);
        const paymentItem = paymentItems[paymentIndex];
        if (!paymentItem) throw new Error("\xD6deme kalemi bulunamad\u0131.");
        setStatus(
          `${rowIndex + 1}. kayd\u0131n ${paymentIndex + 1}. \xF6deme kalemi haz\u0131rlan\u0131yor...`
        );
        await fillPayment(paymentItem);
        setStatus(
          `${formatAmountTR(
            paymentItem.amount
          )} TL \xF6deme forma yaz\u0131ld\u0131. Para\u015F\xFCt'teki \xD6DEME EKLE butonuna manuel bas.`
        );
      } catch (err) {
        console.error("[AJANS] \xD6deme doldurma hatas\u0131:", err);
        setStatus(err.message || String(err), true);
      } finally {
        isFilling = false;
        setPaymentButtonLoading(button, false);
      }
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
        setStatus(`${index + 1}. kay\u0131t forma dolduruldu. Kaydetme i\u015Flemini manuel yap.`);
      } catch (err) {
        console.error("[AJANS] Doldurma hatas\u0131:", err);
        setStatus(err.message || String(err), true);
      } finally {
        isFilling = false;
        setFillButtonLoading(button, false);
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
