import { PANEL_ID } from "../config/constants.js";
import { getSafePanelPosition } from "./storage.js";
import { setupHoverEffects } from "./panelHover.js";
import { PANEL_COLORS } from "./panelTheme.js";

const { ACCENT, TEXT, MUTED, BORDER, SOFT_BG } = PANEL_COLORS;

export function createPanelElement() {
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
    ${
      savedPos
        ? `left:${savedPos.left}px; top:${savedPos.top}px;`
        : "right:24px; top:110px;"
    }
    width: 360px;
    z-index: 2147483647;
    background: #ffffff;
    border: 1px solid ${BORDER};
    border-radius: 14px;
    padding: 0;
    box-shadow: 0 18px 50px rgba(15, 23, 42, .18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: ${TEXT};
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
      border-bottom:1px solid ${BORDER};
      cursor:move;
    ">
      <div style="display:flex; align-items:center; gap:8px; min-width:0;">
        <span aria-hidden="true" style="
          width:8px; height:8px; border-radius:50%;
          background:${ACCENT}; flex:0 0 auto;
        "></span>
        <div id="ajans-gider-title-text" style="font-weight:600; font-size:13px; color:${TEXT}; letter-spacing:-0.01em;">
          Gider Doldurucu
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:2px;">
        <button id="ajans-gider-help-toggle" title="Nasıl kullanılır?" aria-label="Yardım" style="
          border:0;
          background:transparent;
          color:${MUTED};
          border-radius:6px;
          width:26px; height:26px;
          cursor:pointer;
          font-size:14px;
          font-weight:600;
          display:inline-flex; align-items:center; justify-content:center;
        ">?</button>
        <button id="ajans-gider-minimize" title="Küçült" aria-label="Küçült" style="
          border:0;
          background:transparent;
          color:${MUTED};
          border-radius:6px;
          width:26px; height:26px;
          cursor:pointer;
          font-size:16px;
          line-height:1;
          display:inline-flex; align-items:center; justify-content:center;
        ">–</button>
      </div>
    </div>

    <div id="ajans-gider-body" style="padding:12px;">
      <div id="ajans-gider-help" hidden style="
        margin-bottom:10px;
        padding:10px 12px;
        background:${SOFT_BG};
        border:1px solid ${BORDER};
        border-radius:10px;
        font-size:12px;
        color:${MUTED};
        line-height:1.5;
      ">
        <span id="ajans-gider-help-content"></span>
      </div>

      <div id="ajans-gider-salary-tabs" hidden style="
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:4px;
        margin-bottom:10px;
        padding:3px;
        background:${SOFT_BG};
        border:1px solid ${BORDER};
        border-radius:9px;
      ">
        <button type="button" data-salary-mode="expense" style="
          min-width:0;
          height:30px;
          padding:0 6px;
          border:0;
          border-radius:7px;
          background:transparent;
          color:${MUTED};
          cursor:pointer;
          font-size:11px;
          font-weight:600;
          font-family:inherit;
          line-height:1.15;
        ">Gider</button>
        <button type="button" data-salary-mode="main-bes" style="
          min-width:0;
          height:30px;
          padding:0 6px;
          border:0;
          border-radius:7px;
          background:transparent;
          color:${MUTED};
          cursor:pointer;
          font-size:11px;
          font-weight:600;
          font-family:inherit;
          line-height:1.15;
        ">Ana+BES</button>
        <button type="button" data-salary-mode="remaining" style="
          min-width:0;
          height:30px;
          padding:0 6px;
          border:0;
          border-radius:7px;
          background:transparent;
          color:${MUTED};
          cursor:pointer;
          font-size:11px;
          font-weight:600;
          font-family:inherit;
          line-height:1.15;
        ">Kalan</button>
      </div>

      <div id="ajans-gider-data-collapsed" hidden style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:9px 12px;
        background:${SOFT_BG};
        border:1px solid ${BORDER};
        border-radius:10px;
        font-size:12px;
        color:${TEXT};
        margin-bottom:10px;
      ">
        <span style="display:inline-flex; align-items:center; gap:6px; min-width:0;">
          <span aria-hidden="true" style="color:#10b981; font-weight:700;">✓</span>
          <span id="ajans-gider-data-summary" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            Veri hazır
          </span>
        </span>
        <button id="ajans-gider-edit-data" style="
          border:0;
          background:transparent;
          color:${ACCENT};
          cursor:pointer;
          font-size:12px;
          font-weight:600;
          padding:2px 4px;
        ">Düzenle</button>
      </div>

      <div id="ajans-gider-textarea-wrapper" style="margin-bottom:10px;">
        <textarea id="ajans-gider-textarea" placeholder="Excel satırlarını buraya yapıştır" style="
          width:100%;
          height:96px;
          box-sizing:border-box;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size:12px;
          padding:8px 10px;
          border:1px solid ${BORDER};
          border-radius:10px;
          resize:vertical;
          color:${TEXT};
          background:#ffffff;
          outline:none;
        "></textarea>
      </div>

      <div id="ajans-gider-empty" style="
        padding:14px;
        background:${SOFT_BG};
        border:1px dashed ${BORDER};
        border-radius:10px;
        font-size:12px;
        color:${MUTED};
        text-align:center;
        line-height:1.5;
      ">
        Veriyi yapıştırınca seçili kayıt burada görünecek.
      </div>

      <div id="ajans-gider-record" hidden style="
        border:1px solid ${BORDER};
        border-radius:12px;
        background:#ffffff;
        overflow:hidden;
      ">
        <div style="
          display:flex;
          align-items:center;
          gap:6px;
          padding:8px 10px;
          background:${SOFT_BG};
          border-bottom:1px solid ${BORDER};
        ">
          <button id="ajans-gider-prev" title="Önceki kayıt" aria-label="Önceki kayıt" style="
            border:1px solid ${BORDER};
            background:#ffffff;
            color:${TEXT};
            border-radius:7px;
            width:26px; height:26px;
            cursor:pointer;
            font-size:14px;
            line-height:1;
            flex:0 0 auto;
            display:inline-flex; align-items:center; justify-content:center;
          ">‹</button>

          <div style="position:relative; flex:1 1 auto; min-width:0;">
            <select id="ajans-gider-row-select" title="Kayıt seç" style="
              appearance:none;
              -webkit-appearance:none;
              width:100%;
              height:28px;
              padding:0 26px 0 10px;
              border:1px solid ${BORDER};
              border-radius:7px;
              background:#ffffff;
              color:${TEXT};
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
              color:${MUTED};
              font-size:10px;
            ">▾</span>
          </div>

          <button id="ajans-gider-next" title="Sonraki kayıt" aria-label="Sonraki kayıt" style="
            border:1px solid ${BORDER};
            background:#ffffff;
            color:${TEXT};
            border-radius:7px;
            width:26px; height:26px;
            cursor:pointer;
            font-size:14px;
            line-height:1;
            flex:0 0 auto;
            display:inline-flex; align-items:center; justify-content:center;
          ">›</button>
        </div>

        <div style="padding:12px;">
          <div id="ajans-gider-supplier" style="
            font-size:15px;
            font-weight:700;
            color:${TEXT};
            letter-spacing:-0.01em;
            line-height:1.3;
            word-break:break-word;
          ">—</div>

          <div id="ajans-gider-meta" style="
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            margin-top:6px;
            font-size:11px;
            color:${MUTED};
          "></div>

          <div id="ajans-gider-amount" style="
            margin-top:10px;
            font-size:22px;
            font-weight:700;
            color:${TEXT};
            letter-spacing:-0.02em;
          ">₺ 0,00</div>

          <div id="ajans-gider-dates" style="
            margin-top:4px;
            font-size:11px;
            color:${MUTED};
          "></div>

          <div id="ajans-gider-title" title="" style="
            margin-top:10px;
            padding-top:10px;
            border-top:1px solid ${BORDER};
            font-size:12px;
            color:${MUTED};
            line-height:1.45;
            word-break:break-word;
            display:-webkit-box;
            -webkit-line-clamp:2;
            -webkit-box-orient:vertical;
            overflow:hidden;
          ">—</div>
        </div>
      </div>

      <div id="ajans-gider-status-wrapper" hidden style="
        margin-top:10px;
        display:flex;
        align-items:flex-start;
        gap:6px;
        font-size:11px;
        color:${MUTED};
        line-height:1.45;
      ">
        <span id="ajans-gider-status-icon" aria-hidden="true" style="flex:0 0 auto;">·</span>
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
          color:${MUTED};
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
            background:${ACCENT};
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
            background:${ACCENT};
            color:#ffffff;
            border:0;
            border-radius:9px;
            font-weight:600;
            font-size:13px;
            cursor:pointer;
            box-shadow: 0 1px 0 rgba(15,23,42,.05);
            letter-spacing:-0.01em;
          ">Ödemeyi Başlat</button>
        </div>

        <div id="ajans-gider-salary-actions" style="display:none;">
          <button id="ajans-gider-salary" style="
            padding:9px 14px;
            background:${ACCENT};
            color:#ffffff;
            border:0;
            border-radius:9px;
            font-weight:600;
            font-size:13px;
            cursor:pointer;
            box-shadow: 0 1px 0 rgba(15,23,42,.05);
            letter-spacing:-0.01em;
          ">Maaş Gideri Oluştur</button>
        </div>
      </div>
    </div>
  `;
}
