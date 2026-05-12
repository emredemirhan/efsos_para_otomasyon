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

function inferBrandFromTitle(title) {
  const firstToken = String(title || "")
    .trim()
    .split(/\s+/)[0]
    ?.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

  if (!firstToken) return "";

  const upper = firstToken.toLocaleUpperCase("tr-TR");
  const hasLetter = /\p{L}/u.test(firstToken);

  if (!hasLetter || firstToken !== upper) return "";

  return firstToken;
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
      "kalem_tutari",
      "gider_tutari",
      "ana_gider_tutari",
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

  const usesFourColumnExpenseFormat = !hasHeader && rows[0]?.length === 4;
  const usesFiveColumnExpenseFormat = !hasHeader && rows[0]?.length === 5;
  const usesShortBrandInference =
    usesFourColumnExpenseFormat || usesFiveColumnExpenseFormat;
  const headers = hasHeader
    ? rows.shift().map(keyify)
    : usesFourColumnExpenseFormat
      ? ["kisi", "marka", "kalem_tutari", "kayit_ismi"]
      : usesFiveColumnExpenseFormat
        ? ["kisi", "marka", "grup_toplam", "kalem_tutari", "kayit_ismi"]
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

      const amount = pick(raw, [
        "kalem_tutari",
        "gider_tutari",
        "ana_gider_tutari",
        "tutar",
        "toplam_tutar",
        "toplam",
        "amount",
      ]);
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

      const rawBrand = pick(raw, ["marka", "kategori", "gider_kategorisi"]);
      const inferredBrand = usesShortBrandInference
        ? inferBrandFromTitle(title)
        : "";
      const brand = inferredBrand || rawBrand;
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
        rawBrand,
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
