import { keyify } from "./text.js";
import { nextPaymentDate, parseAmount, parseDate } from "./format.js";

function pick(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }

  return "";
}

export function parseDelimitedText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const source = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

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

    if (char === "\t" && !inQuotes) {
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

export function parseTable(text) {
  const rows = parseDelimitedText(text);

  if (!rows.length) return [];

  const firstRowKeys = rows[0].map(keyify);

  const hasHeader = firstRowKeys.some((key) =>
    [
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
      "etiket",
    ].includes(key),
  );

  const headers = hasHeader
    ? rows.shift().map(keyify)
    : [
        "toplam_tutar",
        "kisi",
        "kayit_ismi",
        "marka",
        "fis_fatura_tarihi",
        "odenecegi_tarih",
        "etiket",
      ];

  return rows
    .map((cols) => {
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
        "proje",
      ]);

      const brand = pick(raw, ["marka", "kategori", "gider_kategorisi"]);
      const tag = pick(raw, ["etiket", "tag"]);

      const issueDateRaw = pick(raw, [
        "fis_fatura_tarihi",
        "fatura_tarihi",
        "tarih",
      ]);

      const dueDateRaw = pick(raw, ["odenecegi_tarih", "odeme_tarihi"]);

      return {
        amount,
        supplier,
        title,
        brand,
        tag,
        issueDate: parseDate(issueDateRaw) || new Date(),
        dueDate: parseDate(dueDateRaw) || nextPaymentDate(),
      };
    })
    .filter((row) => {
      const amountNumber = parseAmount(row.amount);

      if (!amountNumber) return false;
      if (!row.supplier && !row.title && !row.brand) return false;

      return true;
    });
}
