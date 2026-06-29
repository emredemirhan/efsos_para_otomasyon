import { $ } from "../parasut/dom.js";
import { PANEL_COLORS } from "./panelTheme.js";

const FLOW_TITLES = {
  expense: "Gider Doldurucu",
  payment: "Ödeme Doldurucu",
  salary: "Maaş Doldurucu",
  idle: "Gider / Ödeme Doldurucu",
};

const SALARY_MODE_LABELS = {
  expense: "Gider",
  "main-bes": "Ana+BES",
  remaining: "Kalan",
};

const FLOW_HELP = {
  expense:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "<b>Sütunlar:</b> Kişi · Marka · Tutar · Kayıt İsmi<br>" +
    "Seçili kaydı <b>Ana Gideri Doldur</b> ile yeni gider formuna yazar; detay sayfasındaysan formu otomatik açar. Kaydetmeyi sen yaparsın.",
  payment:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "<b>Ödeme sütunları:</b> Ödeme Tutarı · Ödeme Tarihi · Ödeme Hesabı<br>" +
    "Birden fazla ödeme için tutar/tarih/hesabı <b>/</b> ile ayır. <b>Ödemeyi Başlat</b> tedarikçiyi bulup ödeme formunu doldurur; son <b>ÖDEME EKLE</b>'ye sen basarsın.",
  salary:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "<b>Gider:</b> Çalışan · Kayıt İsmi · Hak Ediş Tarihi · Toplam Tutar · Ödeneceği Tarih<br>" +
    "<b>Ana+BES / Kalan:</b> Kayıt İsmi ile maaş kaydı bulunur, ilgili ödeme bloğu detay sayfasına yazılır; son <b>ÖDEME EKLE</b>'ye sen basarsın.",
  idle:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "Gider formu, tedarikçi sayfası veya çalışanlar sayfasına gidince ilgili araç çıkar.",
};

export function getRecordKind(flow) {
  if (flow === "payment") return "payment";
  if (flow === "salary") return "salary";
  return "expense";
}

function updateSalaryTabs(flow, salaryMode) {
  const tabs = $("#ajans-gider-salary-tabs");
  if (!tabs) return;

  tabs.hidden = flow !== "salary";
  tabs.style.display = flow === "salary" ? "grid" : "none";

  tabs.querySelectorAll("[data-salary-mode]").forEach((button) => {
    const isActive = button.getAttribute("data-salary-mode") === salaryMode;

    button.style.background = isActive ? "#ffffff" : "transparent";
    button.style.color = isActive ? PANEL_COLORS.TEXT : PANEL_COLORS.MUTED;
    button.style.boxShadow = isActive ? "0 1px 2px rgba(15,23,42,.08)" : "none";
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function updateFlowTabs(flow) {
  const tabs = $("#ajans-gider-flow-tabs");
  if (!tabs) return;

  tabs.querySelectorAll("[data-active-flow]").forEach((button) => {
    const isActive = button.getAttribute("data-active-flow") === flow;

    button.style.background = isActive ? "#ffffff" : "transparent";
    button.style.color = isActive ? PANEL_COLORS.TEXT : PANEL_COLORS.MUTED;
    button.style.boxShadow = isActive ? "0 1px 2px rgba(15,23,42,.08)" : "none";
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

export function updateFlowVisibility(flow, options = {}) {
  const expenseActions = $("#ajans-gider-expense-actions");
  const paymentActions = $("#ajans-gider-payment-actions");
  const salaryActions = $("#ajans-gider-salary-actions");
  const titleText = $("#ajans-gider-title-text");
  const helpContent = $("#ajans-gider-help-content");
  const salaryMode = options.salaryMode || "expense";
  const canRunExpense = options.canRunExpense ?? flow === "expense";
  const canRunPayment = options.canRunPayment ?? flow === "payment";
  const canRunSalary = options.canRunSalary ?? flow === "salary";

  if (expenseActions) {
    expenseActions.style.display =
      flow === "expense" && canRunExpense ? "block" : "none";
  }

  if (paymentActions) {
    paymentActions.style.display =
      flow === "payment" && canRunPayment ? "block" : "none";
  }

  if (salaryActions) {
    salaryActions.style.display =
      flow === "salary" && canRunSalary ? "block" : "none";
  }

  if (titleText) {
    const title = FLOW_TITLES[flow] || FLOW_TITLES.idle;
    titleText.textContent =
      flow === "salary" ? `${title} · ${SALARY_MODE_LABELS[salaryMode]}` : title;
  }

  if (helpContent) {
    helpContent.innerHTML = FLOW_HELP[flow] || FLOW_HELP.idle;
  }

  updateFlowTabs(flow);
  updateSalaryTabs(flow, salaryMode);
}
