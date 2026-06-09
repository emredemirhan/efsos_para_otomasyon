import { $ } from "../parasut/dom.js";

const FLOW_TITLES = {
  expense: "Gider Doldurucu",
  payment: "Ödeme Doldurucu",
  salary: "Maaş Doldurucu",
  idle: "Gider / Ödeme Doldurucu",
};

const FLOW_HELP = {
  expense:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "<b>Sütunlar:</b> Kişi · Marka · Tutar · Kayıt İsmi<br>" +
    "Seçili kaydı <b>Ana Gideri Doldur</b> ile forma yazar; kaydetmeyi sen yaparsın.",
  payment:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "<b>Ödeme sütunları:</b> Ödeme Tutarı · Ödeme Tarihi · Ödeme Hesabı<br>" +
    "Birden fazla ödeme için tutar/tarih/hesabı <b>/</b> ile ayır. <b>Ödemeyi Başlat</b> tedarikçiyi bulup ödeme formunu doldurur; son <b>ÖDEME EKLE</b>'ye sen basarsın.",
  salary:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "<b>Sütunlar:</b> Çalışan · Kayıt İsmi · Hak Ediş Tarihi · Toplam Tutar · Ödeneceği Tarih<br>" +
    "Maaş detay sayfasında ödeme için <b>Ana Maaş / BES / Kalan Maaş</b> bloklarında tarih, hesap, tutar ve açıklama sütunları kullanılır. Boş tutarlı blok atlanır; son <b>ÖDEME EKLE</b>'ye sen basarsın.",
  idle:
    "Excel satırlarını kopyalayıp aşağıya yapıştır. Sayfa değişse de veri kalır.<br>" +
    "Gider formu, tedarikçi sayfası veya çalışanlar sayfasına gidince ilgili araç çıkar.",
};

export function getRecordKind(flow) {
  if (flow === "payment") return "payment";
  if (flow === "salary") return "salary";
  return "expense";
}

export function updateFlowVisibility(flow) {
  const expenseActions = $("#ajans-gider-expense-actions");
  const paymentActions = $("#ajans-gider-payment-actions");
  const salaryActions = $("#ajans-gider-salary-actions");
  const titleText = $("#ajans-gider-title-text");
  const helpContent = $("#ajans-gider-help-content");

  if (expenseActions) {
    expenseActions.style.display = flow === "expense" ? "block" : "none";
  }

  if (paymentActions) {
    paymentActions.style.display = flow === "payment" ? "block" : "none";
  }

  if (salaryActions) {
    salaryActions.style.display = flow === "salary" ? "block" : "none";
  }

  if (titleText) {
    titleText.textContent = FLOW_TITLES[flow] || FLOW_TITLES.idle;
  }

  if (helpContent) {
    helpContent.innerHTML = FLOW_HELP[flow] || FLOW_HELP.idle;
  }
}
