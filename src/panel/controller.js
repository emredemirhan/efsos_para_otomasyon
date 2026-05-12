import { PANEL_ID, STORAGE_TEXT_KEY } from "../config/constants.js";
import { formatAmountTR, formatDateTR, parseAmount } from "../core/format.js";
import { parsePaymentItems, paymentItemsTotal } from "../core/paymentParser.js";
import { parseTable } from "../core/tableParser.js";
import { fillExpense } from "../parasut/expenseFlow.js";
import { $ } from "../parasut/dom.js";
import { removeDuplicatePanels } from "../parasut/frame.js";
import { getPageDetectionSnapshot } from "../parasut/pageDetection.js";
import { fillPayment } from "../parasut/paymentFlow.js";
import { makePanelDraggable } from "./drag.js";
import {
  applyMinimizedState,
  createPanelElement,
  setFillButtonLoading,
  setPaymentButtonLoading,
  setStatus,
} from "./view.js";
import {
  clearSelectionState,
  getSelectedIndex,
  getSelectedPaymentIndex,
  savePanelPosition,
  setPanelMinimized,
  setSelectedIndex,
  setSelectedPaymentIndex,
} from "./storage.js";

let isFilling = false;
let lastDecisionLogKey = "";

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
    setStatus("Veri okunamadı.", true);
    return;
  }

  select.innerHTML = "";

  if (!rows.length) {
    paymentSelect.innerHTML = "";
    preview.textContent = "Veriyi yapıştırınca burada kayıt listesi çıkacak.";
    setStatus(
      flow === "expense"
        ? "Gider formundasın. Veri yapıştırınca ana gideri doldurabilirsin."
        : flow === "payment"
          ? "Fiş/fatura detayındasın. Veri yapıştırınca ödeme kalemini hazırlayabilirsin."
          : "Popup hazır. Gider formuna veya fiş/fatura detayına gidince ilgili işlem görünür.",
    );
    return;
  }

  const selectedIndex = getSelectedIndex(rows.length);

  rows.forEach((row, index) => {
    const option = document.createElement("option");
    option.value = String(index);

    const title = String(row.title || "Kayıt ismi yok")
      .replace(/\s+/g, " ")
      .trim();
    const shortTitle = title.length > 65 ? `${title.slice(0, 65)}...` : title;

    option.textContent = `${index + 1}. ${
      row.supplier || "Tedarikçi yok"
    } | ${row.brand || "Kategori yok"} | ${formatAmountTR(
      row.amount,
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
  const paymentTotalMismatch =
    paymentItems.length > 1 && Math.abs(parsedPaymentTotal - rowAmount) >= 0.01;

  paymentSelect.innerHTML = "";

  paymentItems.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = String(index);

    const description = String(item.description || "Ödeme")
      .replace(/\s+/g, " ")
      .trim();
    const shortDescription =
      description.length > 58 ? `${description.slice(0, 58)}...` : description;

    option.textContent = `${index + 1}. ${formatAmountTR(
      item.amount,
    )} TL | ${shortDescription}`;

    paymentSelect.appendChild(option);
  });

  paymentSelect.value = String(selectedPaymentIndex);
  paymentSelect.disabled = paymentItems.length <= 1;

  const previewLines = [
    `Seçili kayıt: ${selectedIndex + 1} / ${rows.length}`,
    `Tedarikçi: ${selected.supplier || "-"}`,
    `Kategori / Marka: ${selected.brand || "-"}`,
    `Tutar: ${formatAmountTR(selected.amount)} TL`,
    `Fiş/Fatura tarihi: ${formatDateTR(selected.issueDate)}`,
    `Ödeneceği tarih: ${formatDateTR(selected.dueDate)}`,
    `Etiket: ${selected.tag || "-"}`,
  ];

  if (flow === "payment") {
    previewLines.push(
      `Ödeme kalemi: ${
      selectedPayment
        ? `${selectedPaymentIndex + 1} / ${paymentItems.length} - ${formatAmountTR(
            selectedPayment.amount,
          )} TL`
        : "bulunamadı"
    }`);

    if (paymentTotalMismatch) {
      previewLines.push(
        `Uyarı: Alt ödeme toplamı ${formatAmountTR(
          parsedPaymentTotal,
        )} TL, ana tutar ${formatAmountTR(rowAmount)} TL.`,
      );
    }
  }

  preview.textContent = [
    ...previewLines,
    "",
    selected.title || "Kayıt ismi yok",
  ].join("\n");

  setStatus(
    flow === "expense"
      ? "Gider formundasın. Bu ekranda sadece ana gider girişi yapılır."
      : flow === "payment"
        ? "Fiş/fatura detayındasın. Bu ekranda sadece ödeme kalemi hazırlanır."
        : "Popup hazır. Gider formuna gidince seçili kaydı doldurabilirsin.",
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
      if (!rows.length) throw new Error("Satır bulunamadı.");

      const rowIndex = getSelectedIndex(rows.length);
      const row = rows[rowIndex];
      const paymentItems = parsePaymentItems(row);
      const paymentIndex = getSelectedPaymentIndex(paymentItems.length);
      const paymentItem = paymentItems[paymentIndex];

      if (!paymentItem) throw new Error("Ödeme kalemi bulunamadı.");

      setStatus(
        `${rowIndex + 1}. kaydın ${paymentIndex + 1}. ödeme kalemi hazırlanıyor...`,
      );

      await fillPayment(paymentItem);

      setStatus(
        `${formatAmountTR(
          paymentItem.amount,
        )} TL ödeme forma yazıldı. Paraşüt'teki ÖDEME EKLE butonuna manuel bas.`,
      );
    } catch (err) {
      console.error("[AJANS] Ödeme doldurma hatası:", err);
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
