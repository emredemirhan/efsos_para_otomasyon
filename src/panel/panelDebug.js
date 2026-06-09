import { PANEL_ID, STORAGE_TEXT_KEY } from "../config/constants.js";
import { inspectTableParse } from "../core/tableParser.js";
import { $ } from "../parasut/dom.js";

let lastParseDebugKey = "";

export function appendDebugLog(event, details = {}) {
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

export function installDebugHelpers() {
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

export function logParseSnapshot(source, text, options = {}) {
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
