import { PANEL_ID } from "../config/constants.js";
import { $ } from "../parasut/dom.js";
import { getSafePanelPosition, isPanelMinimized } from "./storage.js";

export function createPanelElement() {
  const panel = document.createElement("div");
  panel.id = PANEL_ID;

  const savedPos = getSafePanelPosition();

  panel.style.cssText = `
      position: fixed;
      ${
        savedPos
          ? `left:${savedPos.left}px; top:${savedPos.top}px;`
          : "right:24px; top:110px;"
      }
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
        ">Küçült</button>
      </div>

      <div id="ajans-gider-body" style="padding:14px;">
        <div style="font-size:12px; color:#555; margin-bottom:8px; line-height:1.4;">
          Excel'den tüm satırları tek seferde yapıştır. Sayfa değiştirsen de veri burada kalır.
          <br>
          Header yoksa sıra:
          <br>
          <b>TOPLAM TUTAR, KİŞİ, KAYIT İSMİ, MARKA, TARİH, ÖDENECEĞİ TARİH, ETİKET</b>
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
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Doldurulacak kayıt</label>
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
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Ödeme kalemi</label>
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
        ">Veriyi yapıştırınca burada kayıt listesi çıkacak.</div>

        <div id="ajans-gider-status" style="
          margin-top:8px;
          font-size:12px;
          color:#555;
        ">Hazır.</div>

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
          ">Seçili Ödeme Kalemini Doldur</button>
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
            ">Önceki</button>

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

export function setStatus(message, isError = false) {
  const status = $("#ajans-gider-status");
  if (!status) return;

  status.textContent = message;
  status.style.color = isError ? "#b42318" : "#555";
}

export function setFillButtonLoading(button, loading) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "Dolduruluyor..." : "Ana Gideri Doldur";
  button.style.opacity = loading ? "0.65" : "1";
  button.style.cursor = loading ? "not-allowed" : "pointer";
}

export function setPaymentButtonLoading(button, loading) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading
    ? "Ödeme Hazırlanıyor..."
    : "Seçili Ödeme Kalemini Doldur";
  button.style.opacity = loading ? "0.65" : "1";
  button.style.cursor = loading ? "not-allowed" : "pointer";
}

export function applyMinimizedState(panel, body, button) {
  const minimized = isPanelMinimized();

  body.style.display = minimized ? "none" : "block";
  button.textContent = minimized ? "Aç" : "Küçült";
  panel.style.width = minimized ? "300px" : "480px";
}
