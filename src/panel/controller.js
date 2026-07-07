import { PANEL_ID, STORAGE_TEXT_KEY } from "../config/constants.js";
import { formatAmountTR } from "../core/format.js";
import {
  getPaymentRecords,
  getSalaryPaymentRecords,
  parseTable,
} from "../core/tableParser.js";
import { fillExpense } from "../parasut/expenseFlow.js";
import { goToNewExpenseForm } from "../parasut/expenseNavigation.js";
import { runPayment } from "../parasut/paymentFlow.js";
import {
  isSalaryPaymentFormOpen,
  runSalaryPayment,
} from "../parasut/salaryFlow.js";
import { $, getActiveAppDocument } from "../parasut/dom.js";
import { removeDuplicatePanels } from "../parasut/frame.js";
import {
  getPageDetectionSnapshot,
  isExpenseFormPage,
} from "../parasut/pageDetection.js";
import { makePanelDraggable } from "./drag.js";
import {
  applyMinimizedState,
  createPanelElement,
  setFillButtonLoading,
  setPayButtonLoading,
  setSalaryButtonLoading,
  setStatus,
} from "./view.js";
import {
  appendDebugLog,
  installDebugHelpers,
  logParseSnapshot,
} from "./panelDebug.js";
import { getRecordKind, updateFlowVisibility } from "./panelFlow.js";
import {
  applyDataEditorState,
  applyHelpState,
  renderRecordCard,
  setDataSummary,
} from "./panelRecordCard.js";
import {
  clearPendingExpenseFill,
  clearSelectionState,
  getActiveFlow,
  getPendingExpenseFill,
  getSalaryMode,
  getSelectedIndex,
  savePanelPosition,
  setActiveFlow,
  setPendingExpenseFill,
  setPanelMinimized,
  setSalaryMode,
  setSelectedIndex,
} from "./storage.js";

let isFilling = false;
let isRunningPayment = false;
let isRunningSalary = false;
let lastDecisionLogKey = "";
let isDataEditorOpen = true;
let isHelpOpen = false;
let paymentAwaitingManualSave = false;
let salaryPaymentAwaitingManualSave = false;

const SALARY_PAYMENT_MODE_KINDS = {
  "main-bes": ["Ana Maaş", "BES"],
  remaining: ["Kalan Maaş"],
};

const SALARY_MODE_BUTTON_TEXT = {
  "main-bes": "Ana Maaş / BES Ödemesi",
  remaining: "Kalan Maaş Ödemesi",
};

function getRowsFromTextarea() {
  const textarea = $("#ajans-gider-textarea");
  if (!textarea) return [];

  return parseTable(textarea.value);
}

function getCurrentFlow(snapshot = getPageDetectionSnapshot()) {
  return getActiveFlow(snapshot.flow);
}

function isBusy() {
  return isFilling || isRunningPayment || isRunningSalary;
}

function isPaymentFormOpen() {
  return Boolean($("[data-tns='add-payment']", getActiveAppDocument()));
}

function clearPaymentWaitIfFormClosed() {
  if (paymentAwaitingManualSave && !isPaymentFormOpen()) {
    paymentAwaitingManualSave = false;
  }

  if (salaryPaymentAwaitingManualSave && !isSalaryPaymentFormOpen()) {
    salaryPaymentAwaitingManualSave = false;
  }
}

function getFlowUnavailableMessage(flow, snapshot) {
  if (flow === "payment" && !snapshot.paymentStage) {
    return "Ödeme akışı aktif. Tedarikçiler veya fiş/fatura detay sayfasına geçtiğinde ödeme aracını kullanabilirsin.";
  }

  if (flow === "salary" && !snapshot.salaryStage) {
    return "Maaş akışı aktif. Çalışanlar veya maaş sayfasına geçtiğinde maaş aracını kullanabilirsin.";
  }

  return "";
}

function getActiveRecords(flow = getCurrentFlow()) {
  const rows = getRowsFromTextarea();

  if (flow === "payment") {
    return { kind: "payment", items: getPaymentRecords(rows) };
  }

  if (flow === "salary") {
    const salaryMode = getSalaryMode();

    return {
      kind: "salary-payment",
      items: getSalaryPaymentRecords(rows, {
        paymentKinds: SALARY_PAYMENT_MODE_KINDS[salaryMode],
      }),
    };
  }

  return { kind: "expense", items: rows };
}

function advanceSelectionAfterSuccessfulFill(currentIndex, rowsLength) {
  if (currentIndex >= rowsLength - 1) return false;

  setSelectedIndex(currentIndex + 1);
  syncPanelRows();
  return true;
}

async function runExpenseFill(button) {
  if (isFilling) return;
  isFilling = true;
  setFillButtonLoading(button, true);

  try {
    const rows = getRowsFromTextarea();
    if (!rows.length) throw new Error("Satır bulunamadı.");

    const index = getSelectedIndex(rows.length);
    const row = rows[index];

    if (!isExpenseFormPage()) {
      setPendingExpenseFill(index);
      setStatus("Yeni gider formu açılıyor...");
      await goToNewExpenseForm();
    }

    clearPendingExpenseFill();
    setStatus(`${index + 1}. kayıt dolduruluyor...`);
    await fillExpense(row);

    const advanced = advanceSelectionAfterSuccessfulFill(index, rows.length);
    const nextMessage = advanced
      ? ` ${index + 2}. kayda geçildi.`
      : " Son kayıttasın.";

    setStatus(
      `DOLDURMA BAŞARILI. ${index + 1}. kayıt forma dolduruldu.${nextMessage} Kaydetme işlemini manuel yap.`,
      "success",
    );
  } catch (err) {
    clearPendingExpenseFill();
    console.error("[AJANS] Doldurma hatası:", err);
    setStatus(err.message || String(err), true);
  } finally {
    isFilling = false;
    setFillButtonLoading(button, false);
  }
}

function resumePendingExpenseFill() {
  const pending = getPendingExpenseFill();
  const snapshot = getPageDetectionSnapshot();

  if (!pending || getCurrentFlow(snapshot) !== "expense" || !snapshot.isExpense) {
    return;
  }

  setSelectedIndex(pending.index);
  syncPanelRows();

  const button = $("#ajans-gider-fill");
  if (button) runExpenseFill(button);
}

function syncPanelRows() {
  clearPaymentWaitIfFormClosed();

  const textarea = $("#ajans-gider-textarea");
  const select = $("#ajans-gider-row-select");

  if (!textarea) return;

  const snapshot = getPageDetectionSnapshot();
  const flow = getCurrentFlow(snapshot);
  const salaryMode = getSalaryMode();
  updateFlowVisibility(flow, {
    salaryMode,
    canRunExpense: true,
    canRunPayment: Boolean(snapshot.paymentStage),
    canRunSalary: Boolean(snapshot.salaryStage),
  });
  applyHelpState(isHelpOpen);

  let records = {
    kind: getRecordKind(flow),
    items: [],
  };
  let parseError = null;

  try {
    records = getActiveRecords(flow);
  } catch (err) {
    parseError = err;
  }

  const items = records.items;
  const kind = records.kind;

  if (parseError || (String(textarea.value || "").trim() && !items.length)) {
    logParseSnapshot("sync-empty", textarea.value);
  }

  if (select) {
    select.innerHTML = "";
    items.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);

      const supplier = String(
        kind === "salary" || kind === "salary-payment"
          ? item.employee || "Çalışan yok"
          : item.supplier || "Tedarikçi yok",
      ).trim();
      const shortSupplier =
        supplier.length > 24 ? `${supplier.slice(0, 24)}…` : supplier;
      const amountText = `${formatAmountTR(item.amount)} TL`;
      const suffix =
        (kind === "payment" || kind === "salary-payment") && item.paymentCount > 1
          ? `  ·  Öd. ${item.paymentIndex + 1}/${item.paymentCount}`
          : "";

      option.textContent = `${index + 1} / ${items.length}  ·  ${shortSupplier}  ·  ${amountText}${suffix}`;
      select.appendChild(option);
    });
  }

  setDataSummary(items.length);
  applyDataEditorState(isDataEditorOpen);

  if (parseError) {
    renderRecordCard(null, kind, 0, 0);
    if (!isBusy()) setStatus(String(parseError.message || parseError), true);
    return;
  }

  if (!items.length) {
    renderRecordCard(null, kind, 0, 0);
    if (isBusy()) return;

    const unavailableMessage = getFlowUnavailableMessage(flow, snapshot);
    if (unavailableMessage) {
      setStatus(unavailableMessage);
      return;
    }

    if (flow === "expense") {
      setStatus("Gider akışı aktif. Veri yapıştırınca kayıtları sırayla doldurabilirsin.");
    } else if (flow === "payment") {
      const hasText = String(textarea.value || "").trim().length > 0;
      setStatus(
        hasText
          ? "Ödeme kaydı yok. Excel'e Ödeme Tutarı / Tarihi / Hesabı sütunlarını ekle."
          : "Tedarikçiler sayfasındasın. Excel'i yapıştırınca ödemeleri başlatabilirsin.",
      );
    } else if (flow === "salary") {
      const hasText = String(textarea.value || "").trim().length > 0;
      let message;

      if (salaryMode === "remaining") {
        message = hasText
          ? "Kalan maaş ödeme kaydı yok. Excel'de Kalan Maaş ödeme sütunlarını kontrol et."
          : "Kalan sekmesindesin. Excel'i yapıştırınca kayıt ismiyle maaşı bulup kalan ödemeyi doldurabilirsin.";
      } else {
        message = hasText
          ? "Ana Maaş / BES ödeme kaydı yok. Excel'de Ana Maaş ve BES ödeme sütunlarını kontrol et."
          : "Ana+BES sekmesindesin. Excel'i yapıştırınca kayıt ismiyle maaşı bulup ödemeyi doldurabilirsin.";
      }

      setStatus(message);
    } else {
      setStatus("");
    }
    return;
  }

  const selectedIndex = getSelectedIndex(items.length);
  if (select) select.value = String(selectedIndex);

  renderRecordCard(items[selectedIndex], kind, selectedIndex, items.length);

  if (isBusy()) return;

  const unavailableMessage = getFlowUnavailableMessage(flow, snapshot);
  if (unavailableMessage) {
    setStatus(unavailableMessage);
    return;
  }

  if (flow === "expense") {
    setStatus("");
  } else if (flow === "payment") {
    if (paymentAwaitingManualSave && isPaymentFormOpen()) {
      setStatus(
        'Ödeme formu açık. Kontrol edip Paraşüt içindeki son "ÖDEME EKLE" butonuna manuel bas; form kapandıktan sonra › ile devam et.',
        "success",
      );
      return;
    }

    setStatus("");
  } else if (flow === "salary") {
    const salaryButton = $("#ajans-gider-salary");
    if (salaryButton && !isRunningSalary) {
      salaryButton.textContent = SALARY_MODE_BUTTON_TEXT[salaryMode];
    }

    if (
      kind === "salary-payment" &&
      salaryPaymentAwaitingManualSave &&
      isSalaryPaymentFormOpen()
    ) {
      setStatus(
        'Maaş ödeme formu açık. Kontrol edip Paraşüt içindeki son "ÖDEME EKLE" butonuna manuel bas; form kapandıktan sonra › ile devam et.',
        "success",
      );
      return;
    }

    setStatus("");
  } else {
    setStatus(
      "Gider formu, tedarikçi sayfası veya çalışanlar sayfasına gidince bu kaydı kullanabilirsin.",
    );
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
  const flowTabs = $("#ajans-gider-flow-tabs");
  const salaryTabs = $("#ajans-gider-salary-tabs");

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
      applyDataEditorState(isDataEditorOpen);
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
      applyHelpState(isHelpOpen);
    });
  }

  if (editDataButton) {
    editDataButton.addEventListener("click", () => {
      isDataEditorOpen = true;
      applyDataEditorState(isDataEditorOpen);
      const ta = $("#ajans-gider-textarea");
      if (ta) ta.focus();
    });
  }

  if (flowTabs) {
    flowTabs.querySelectorAll("[data-active-flow]").forEach((button) => {
      button.addEventListener("click", () => {
        const flow = button.getAttribute("data-active-flow");
        if (isBusy() || flow === getCurrentFlow()) return;

        setActiveFlow(flow);
        if (flow !== "expense") clearPendingExpenseFill();
        setSelectedIndex(0);
        syncPanelRows();
      });
    });
  }

  if (salaryTabs) {
    salaryTabs.querySelectorAll("[data-salary-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-salary-mode");
        if (mode === getSalaryMode()) return;

        setSalaryMode(mode);
        setSelectedIndex(0);
        syncPanelRows();
      });
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
    clearPendingExpenseFill();
    isDataEditorOpen = true;
    syncPanelRows();
    setStatus("Veri temizlendi.");
  });

  $("#ajans-gider-fill").addEventListener("click", (event) => {
    runExpenseFill(event.currentTarget);
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
          'Açık ödeme formu var. Önce kontrol edip Paraşüt içindeki son "ÖDEME EKLE" butonuna manuel bas, form kapandıktan sonra sonraki ödemeye geç.',
        );
      }

      const records = getActiveRecords("payment").items;
      if (!records.length) {
        throw new Error(
          "Ödeme kaydı bulunamadı. Excel'e Ödeme Tutarı / Tarihi / Hesabı sütunlarını ekledin mi?",
        );
      }

      const index = getSelectedIndex(records.length);
      const record = records[index];

      setStatus(`${index + 1}. ödeme işleniyor...`);

      await runPayment(record, (message) => setStatus(message));
      paymentAwaitingManualSave = true;

      setStatus(
        `Ödeme formu dolduruldu (${index + 1}/${records.length}). Kontrol edip "ÖDEME EKLE"ye bas, sonra › ile sonraki ödemeye geç.`,
        "success",
      );
    } catch (err) {
      console.error("[AJANS] Ödeme hatası:", err);
      setStatus(err.message || String(err), true);
    } finally {
      isRunningPayment = false;
      setPayButtonLoading(button, false);
    }
  });

  $("#ajans-gider-salary").addEventListener("click", async (event) => {
    const button = event.currentTarget;

    if (isRunningSalary) return;
    isRunningSalary = true;
    setSalaryButtonLoading(button, true);

    try {
      clearPaymentWaitIfFormClosed();

      const records = getActiveRecords("salary").items;

      if (salaryPaymentAwaitingManualSave && isSalaryPaymentFormOpen()) {
        throw new Error(
          'Açık maaş ödeme formu var. Önce kontrol edip Paraşüt içindeki son "ÖDEME EKLE" butonuna manuel bas, form kapandıktan sonra sonraki ödemeye geç.',
        );
      }

      if (!records.length) {
        throw new Error(
          getSalaryMode() === "remaining"
            ? "Kalan maaş ödeme kaydı bulunamadı. Excel'de Kalan Maaş ödeme sütunları var mı?"
            : "Ana Maaş / BES ödeme kaydı bulunamadı. Excel'de Ana Maaş ve BES ödeme sütunları var mı?",
        );
      }

      const index = getSelectedIndex(records.length);
      const record = records[index];

      setStatus(`${index + 1}. maaş ödemesi dolduruluyor...`);

      await runSalaryPayment(record, (message) => setStatus(message));
      salaryPaymentAwaitingManualSave = true;

      setStatus(
        `Maaş ödeme formu dolduruldu (${index + 1}/${records.length}). Kontrol edip "ÖDEME EKLE"ye bas, sonra › ile sonraki ödemeye geç.`,
        "success",
      );
    } catch (err) {
      console.error("[AJANS] Maaş ödeme hatası:", err);
      setStatus(err.message || String(err), true);
    } finally {
      isRunningSalary = false;
      setSalaryButtonLoading(button, false);
      button.textContent = SALARY_MODE_BUTTON_TEXT[getSalaryMode()];
    }
  });

  minimizeButton.addEventListener("click", () => {
    const current = body.style.display === "none";
    setPanelMinimized(!current);
    applyMinimizedState(panel, body, minimizeButton);
    savePanelPosition(panel);
  });

  syncPanelRows();
  window.setTimeout(resumePendingExpenseFill, 300);
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
  const detectedFlow = snapshot.flow;
  const flow = getCurrentFlow(snapshot);
  const decisionLogKey = [
    reason,
    detectedFlow,
    flow,
    snapshot.pathname,
    snapshot.activeDocumentPathname,
    Boolean($(`#${PANEL_ID}`)),
  ].join("|");

  if (decisionLogKey !== lastDecisionLogKey) {
    appendDebugLog("panel-decision", {
      reason,
      detectedFlow,
      flow,
      snapshot,
    });
    lastDecisionLogKey = decisionLogKey;
  }

  if (detectedFlow === "idle") {
    if (isBusy()) return flow;
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
