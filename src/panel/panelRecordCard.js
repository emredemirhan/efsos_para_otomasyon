import { formatAmountTR, formatDateTR } from "../core/format.js";
import { $ } from "../parasut/dom.js";

export function applyDataEditorState(isDataEditorOpen) {
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

export function applyHelpState(isHelpOpen) {
  const help = $("#ajans-gider-help");
  if (!help) return;
  help.hidden = !isHelpOpen;
}

export function setDataSummary(rowCount) {
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

export function renderRecordCard(item, kind, selectedIndex, total) {
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
    const personName =
      kind === "salary"
        ? item.employee || "Çalışan yok"
        : item.supplier || "Tedarikçi yok";
    supplier.textContent = String(personName).trim();
  }

  if (amount) {
    amount.textContent = `₺ ${formatAmountTR(item.amount)}`;
  }

  if (kind === "payment" || kind === "salary-payment") {
    const chips = [];
    if (item.paymentCount > 1) {
      chips.push({
        label: `Ödeme ${item.paymentIndex + 1}/${item.paymentCount}`,
        tone: "accent",
      });
    }
    if (kind === "salary-payment" && item.paymentKind) {
      chips.push({
        label: String(item.paymentKind),
        tone: chips.length ? "muted" : "accent",
      });
    }
    renderMetaChips(meta, chips);

    if (dates) {
      const parts = [];
      if (item.date) parts.push(`Tarih: ${formatDateTR(item.date)}`);
      if (item.account) parts.push(`Hesap: ${String(item.account).trim()}`);
      dates.textContent = parts.join("  ·  ");
      dates.style.display = parts.length ? "block" : "none";
    }

    if (title) {
      const text = String(
        kind === "salary-payment"
          ? item.description || item.salaryTitle || ""
          : item.itemName || "",
      ).trim();
      title.textContent = text;
      title.title = text;
      title.style.display = text ? "-webkit-box" : "none";
    }

    setStepButtonsState(selectedIndex, total);
    return;
  }

  if (kind === "salary") {
    const chips = [{ label: "maaş", tone: "accent" }];
    renderMetaChips(meta, chips);

    if (dates) {
      const parts = [];
      if (item.entitlementDate) {
        parts.push(`Hak ediş: ${formatDateTR(item.entitlementDate)}`);
      }
      if (item.dueDate) parts.push(`Ödenecek: ${formatDateTR(item.dueDate)}`);
      dates.textContent = parts.join("  ·  ");
      dates.style.display = parts.length ? "block" : "none";
    }

    if (title) {
      const text = String(item.title || "").trim();
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
  const rawBrand =
    item.rawBrand && item.rawBrand !== item.brand
      ? String(item.rawBrand).trim()
      : "";

  if (brand) chips.push({ label: brand, tone: "accent" });
  if (tag) chips.push({ label: tag, tone: "muted" });
  if (rawBrand) chips.push({ label: `Excel: ${rawBrand}`, tone: "muted" });
  renderMetaChips(meta, chips);

  if (dates) {
    const parts = [];
    if (item.issueDate) parts.push(`Fatura: ${formatDateTR(item.issueDate)}`);
    if (item.dueDate) parts.push(`Ödeme: ${formatDateTR(item.dueDate)}`);
    dates.textContent = parts.join("  ·  ");
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
