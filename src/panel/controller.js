import { PANEL_ID, STORAGE_TEXT_KEY } from "../config/constants.js";
import { formatAmountTR, formatDateTR } from "../core/format.js";
import { inspectTableParse, parseTable } from "../core/tableParser.js";
import { fillExpense } from "../parasut/expenseFlow.js";
import { $ } from "../parasut/dom.js";
import { removeDuplicatePanels } from "../parasut/frame.js";
import { getPageDetectionSnapshot } from "../parasut/pageDetection.js";
import { makePanelDraggable } from "./drag.js";
import {
  applyMinimizedState,
  createPanelElement,
  setFillButtonLoading,
  setStatus,
} from "./view.js";
import {
  clearSelectionState,
  getSelectedIndex,
  savePanelPosition,
  setPanelMinimized,
  setSelectedIndex,
} from "./storage.js";

let isFilling = false;
let lastDecisionLogKey = "";
let lastParseDebugKey = "";
let isDataEditorOpen = true;
let isHelpOpen = false;

function appendDebugLog(event, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    href: location.href,
    hasPanel: Boolean($(`#${PANEL_ID}`)),
    ...details,
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
    textareaExists: Boolean($("#ajans-gider-textarea")),
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
          title: item.parsed.title,
        })),
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
          amountNumber: item.amountNumber,
        })),
      );
    }

    return snapshot;
  };

  window.ajansGiderTextareaValue = () =>
    $("#ajans-gider-textarea")?.value || "";
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
    snapshot.detectedFormat,
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
    textPreview: snapshot.textPreview,
  });

  if (snapshot.textLength > 0 && snapshot.acceptedCount === 0) {
    console.warn("[AJANS][parse-debug] Veri var ama parse edilen satır yok.", snapshot);
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

function updateFlowVisibility(flow = getCurrentFlow()) {
  const expenseActions = $("#ajans-gider-expense-actions");

  if (expenseActions) {
    expenseActions.style.display = flow === "expense" ? "block" : "none";
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
    summary.textContent = `${rowCount} kayıt hazır`;
  } else {
    summary.textContent = "Veri hazır";
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

function renderRecordCard(row, selectedIndex, rowsLength) {
  const empty = $("#ajans-gider-empty");
  const record = $("#ajans-gider-record");
  const supplier = $("#ajans-gider-supplier");
  const meta = $("#ajans-gider-meta");
  const amount = $("#ajans-gider-amount");
  const dates = $("#ajans-gider-dates");
  const title = $("#ajans-gider-title");

  if (!empty || !record) return;

  if (!row) {
    empty.hidden = false;
    record.hidden = true;
    return;
  }

  empty.hidden = true;
  record.hidden = false;

  if (supplier) {
    supplier.textContent = String(row.supplier || "Tedarikçi yok").trim();
  }

  if (meta) {
    meta.innerHTML = "";

    const chips = [];
    const brand = String(row.brand || "").trim();
    const tag = String(row.tag || "").trim();
    const rawBrand =
      row.rawBrand && row.rawBrand !== row.brand
        ? String(row.rawBrand).trim()
        : "";

    if (brand) chips.push({ label: brand, tone: "accent" });
    if (tag) chips.push({ label: tag, tone: "muted" });
    if (rawBrand) chips.push({ label: `Excel: ${rawBrand}`, tone: "muted" });

    if (!chips.length) {
      meta.style.display = "none";
    } else {
      meta.style.display = "flex";
      chips.forEach(({ label, tone }) => {
        const span = document.createElement("span");
        span.textContent = label;
        span.style.cssText =
          tone === "accent"
            ? `
              padding:2px 8px;
              border-radius:999px;
              background:#e0ecff;
              color:#0f4fc1;
              font-size:11px;
              font-weight:600;
              line-height:1.6;
            `
            : `
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
  }

  if (amount) {
    amount.textContent = `₺ ${formatAmountTR(row.amount)}`;
  }

  if (dates) {
    const parts = [];
    if (row.issueDate) parts.push(`Fatura: ${formatDateTR(row.issueDate)}`);
    if (row.dueDate) parts.push(`Ödeme: ${formatDateTR(row.dueDate)}`);
    dates.textContent = parts.join("  ·  ");
    dates.style.display = parts.length ? "block" : "none";
  }

  if (title) {
    const text = String(row.title || "").trim();
    if (text) {
      title.textContent = text;
      title.title = text;
      title.style.display = "-webkit-box";
    } else {
      title.textContent = "";
      title.title = "";
      title.style.display = "none";
    }
  }

  setStepButtonsState(selectedIndex, rowsLength);
}

function syncPanelRows() {
  const textarea = $("#ajans-gider-textarea");
  const select = $("#ajans-gider-row-select");

  if (!textarea) return;

  const flow = getCurrentFlow();
  updateFlowVisibility(flow);
  applyHelpState();

  let rows = [];
  let parseError = null;

  try {
    rows = parseTable(textarea.value);
  } catch (err) {
    parseError = err;
  }

  if (parseError || (String(textarea.value || "").trim() && !rows.length)) {
    logParseSnapshot("sync-empty", textarea.value);
  }

  if (select) {
    select.innerHTML = "";
    if (rows.length) {
      rows.forEach((row, index) => {
        const option = document.createElement("option");
        option.value = String(index);

        const supplier = String(row.supplier || "Tedarikçi yok").trim();
        const shortSupplier =
          supplier.length > 28 ? `${supplier.slice(0, 28)}…` : supplier;
        const amountText = `${formatAmountTR(row.amount)} TL`;

        option.textContent = `${index + 1} / ${rows.length}  ·  ${shortSupplier}  ·  ${amountText}`;
        select.appendChild(option);
      });
    }
  }

  setDataSummary(rows.length);
  applyDataEditorState();

  if (parseError) {
    renderRecordCard(null, 0, 0);
    setStatus(String(parseError.message || parseError), true);
    return;
  }

  if (!rows.length) {
    renderRecordCard(null, 0, 0);
    if (flow === "expense") {
      setStatus("Gider formundasın. Veri yapıştırınca doldurulur.");
    } else {
      setStatus("");
    }
    return;
  }

  const selectedIndex = getSelectedIndex(rows.length);
  if (select) select.value = String(selectedIndex);

  renderRecordCard(rows[selectedIndex], selectedIndex, rows.length);

  if (flow === "expense") {
    setStatus("");
  } else {
    setStatus("Yeni gider formuna gidince bu kaydı doldurabilirsin.");
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
      pastedLineCount: pastedText
        ? pastedText.replace(/\r\n/g, "\n").split("\n").length
        : 0,
      pastedPreview: pastedText.slice(0, 500),
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
    const rows = getRowsFromTextarea();
    if (!rows.length) return;

    const current = getSelectedIndex(rows.length);
    setSelectedIndex(Math.max(0, current - 1));
    syncPanelRows();
  });

  $("#ajans-gider-next").addEventListener("click", () => {
    const rows = getRowsFromTextarea();
    if (!rows.length) return;

    const current = getSelectedIndex(rows.length);
    setSelectedIndex(Math.min(rows.length - 1, current + 1));
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
      if (!rows.length) throw new Error("Satır bulunamadı.");

      const index = getSelectedIndex(rows.length);
      const row = rows[index];

      setStatus(`${index + 1}. kayıt dolduruluyor...`);

      await fillExpense(row);

      setStatus(`${index + 1}. kayıt forma dolduruldu. Kaydetme işlemini manuel yap.`);
    } catch (err) {
      console.error("[AJANS] Doldurma hatası:", err);
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

export function injectPanel() {
  if (!document.body) return;

  removeDuplicatePanels();

  if ($(`#${PANEL_ID}`)) return;

  const panel = createPanelElement();
  document.body.appendChild(panel);

  registerPanelEvents(panel);

  console.log("[AJANS] Gider paneli eklendi:", location.href);
  appendDebugLog("panel-injected", {
    snapshot: getPageDetectionSnapshot(),
  });
}

export function removePanel(reason = "unknown", snapshot = getPageDetectionSnapshot()) {
  const panels = document.querySelectorAll(`#${PANEL_ID}`);

  if (panels.length) {
    appendDebugLog("panel-remove-requested", {
      reason,
      panelCount: panels.length,
      snapshot,
    });
  }

  panels.forEach((panel) => panel.remove());
}

export function ensurePanelForCurrentPage(reason = "refresh") {
  const snapshot = getPageDetectionSnapshot();
  const flow = snapshot.flow;
  const decisionLogKey = [
    reason,
    flow,
    snapshot.pathname,
    snapshot.activeDocumentPathname,
    Boolean($(`#${PANEL_ID}`)),
  ].join("|");

  if (decisionLogKey !== lastDecisionLogKey) {
    appendDebugLog("panel-decision", {
      reason,
      flow,
      snapshot,
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

export function keepPanelInViewport() {
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

export { syncPanelRows };
