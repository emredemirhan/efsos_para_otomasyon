import { keyify } from "./text.js";
import { nextPaymentDate, parseAmount, parseDate } from "./format.js";

const HEADER_KEYS = [
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
  "kategori",
  "gider_kategorisi",
  "fis_fatura_tarihi",
  "fatura_tarihi",
  "odenecegi_tarih",
  "odeme_tarihi",
  "etiket",
];

function pick(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }

  return "";
}

function detectFormat(rows, mutateRows = false) {
  if (!rows.length) {
    return {
      headers: [],
      firstRowKeys: [],
      hasHeader: false,
      detectedFormat: "empty",
    };
  }

  const firstRowKeys = rows[0].map(keyify);
  const hasHeader = firstRowKeys.some((key) => HEADER_KEYS.includes(key));

  if (hasHeader) {
    const headerRow = mutateRows ? rows.shift() : rows[0];

    return {
      headers: headerRow.map(keyify),
      firstRowKeys,
      hasHeader: true,
      detectedFormat: "header",
    };
  }

  if (rows[0]?.length === 4) {
    return {
      headers: ["kisi", "marka", "kalem_tutari", "kayit_ismi"],
      firstRowKeys,
      hasHeader: false,
      detectedFormat: "four-column-expense",
    };
  }

  if (rows[0]?.length === 5) {
    return {
      headers: ["kisi", "marka", "grup_toplam", "kalem_tutari", "kayit_ismi"],
      firstRowKeys,
      hasHeader: false,
      detectedFormat: "five-column-expense",
    };
  }

  return {
    headers: [
      "toplam_tutar",
      "kisi",
      "kayit_ismi",
      "marka",
      "fis_fatura_tarihi",
      "odenecegi_tarih",
      "etiket",
    ],
    firstRowKeys,
    hasHeader: false,
    detectedFormat: "legacy-default",
  };
}

function parseRawRow(cols, headers) {
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

  const brand = pick(raw, ["marka", "kategori", "gider_kategorisi"]);
  const tag = pick(raw, ["etiket", "tag"]);

  const issueDateRaw = pick(raw, [
    "fis_fatura_tarihi",
    "fatura_tarihi",
    "tarih",
  ]);

  const dueDateRaw = pick(raw, ["odenecegi_tarih", "odeme_tarihi"]);

  return {
    raw,
    row: {
      amount,
      supplier,
      title,
      brand,
      rawBrand: brand,
      tag,
      issueDate: parseDate(issueDateRaw) || new Date(),
      dueDate: parseDate(dueDateRaw) || nextPaymentDate(),
    },
  };
}

function getRejectedReason(row) {
  if (!parseAmount(row.amount)) return "amount-empty-or-zero";
  if (!row.supplier && !row.title && !row.brand) return "missing-row-identity";

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

  const { headers } = detectFormat(rows, true);

  return rows
    .map((cols) => parseRawRow(cols, headers).row)
    .filter((row) => !getRejectedReason(row));
}

export function inspectTableParse(text) {
  const source = String(text || "");
  const rows = parseDelimitedText(source);
  const format = detectFormat([...rows]);
  const dataRows = format.hasHeader ? rows.slice(1) : rows;
  const accepted = [];
  const rejected = [];

  dataRows.forEach((cols, index) => {
    const parsed = parseRawRow(cols, format.headers);
    const reason = getRejectedReason(parsed.row);
    const item = {
      rowNumber: format.hasHeader ? index + 2 : index + 1,
      columnCount: cols.length,
      columns: cols,
      raw: parsed.raw,
      parsed: {
        supplier: parsed.row.supplier,
        brand: parsed.row.brand,
        amount: parsed.row.amount,
        title: parsed.row.title,
        tag: parsed.row.tag,
      },
      amountNumber: parseAmount(parsed.row.amount),
    };

    if (reason) {
      rejected.push({ ...item, reason });
    } else {
      accepted.push(item);
    }
  });

  return {
    textLength: source.length,
    trimmedLength: source.trim().length,
    lineCount: source ? source.replace(/\r\n/g, "\n").split("\n").length : 0,
    tabCount: (source.match(/\t/g) || []).length,
    semicolonCount: (source.match(/;/g) || []).length,
    commaCount: (source.match(/,/g) || []).length,
    parsedPhysicalRows: rows.length,
    firstRowColumnCount: rows[0]?.length || 0,
    firstRow: rows[0] || [],
    firstRowKeys: format.firstRowKeys,
    hasHeader: format.hasHeader,
    detectedFormat: format.detectedFormat,
    headers: format.headers,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    acceptedPreview: accepted.slice(0, 5),
    rejectedPreview: rejected.slice(0, 10),
    textPreview: source.slice(0, 500),
  };
}
