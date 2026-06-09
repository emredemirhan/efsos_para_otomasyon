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
  "tedarikci_kisi",
  "kayit_ismi",
  "kayit_kalemi",
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
  "odeme_tutari",
  "odeme_tutarlari",
  "odeme",
  "odeme_hesabi",
  "odeme_hesaplari",
  "cikis_hesabi",
  "hesap",
];

function pick(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }

  return "";
}

function splitSlash(value) {
  return String(value || "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function buildPayments({ amountRaw, dateRaw, accountRaw, description }) {
  const amounts = splitSlash(amountRaw);
  if (!amounts.length) return [];

  const isMulti = amounts.length > 1;
  const dates = isMulti
    ? splitSlash(dateRaw)
    : [String(dateRaw || "").trim()].filter(Boolean);
  const accounts = isMulti
    ? splitSlash(accountRaw)
    : [String(accountRaw || "").trim()].filter(Boolean);

  return amounts.map((amount, index) => {
    const dateText = dates[index] ?? dates[0] ?? "";
    const accountText = accounts[index] ?? accounts[0] ?? "";

    return {
      amount,
      amountNumber: parseAmount(amount),
      dateText,
      date: parseDate(dateText),
      account: accountText,
      description,
    };
  });
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

  if (rows[0]?.length === 7) {
    return {
      headers: [
        "kisi",
        "marka",
        "kalem_tutari",
        "kayit_ismi",
        "odeme_tutari",
        "odeme_hesabi",
        "odeme_tarihi",
      ],
      firstRowKeys,
      hasHeader: false,
      detectedFormat: "seven-column-expense-payment",
    };
  }

  if (rows[0]?.length === 8) {
    return {
      headers: [
        "kisi",
        "marka",
        "grup_toplam",
        "kalem_tutari",
        "kayit_ismi",
        "odeme_tutari",
        "odeme_hesabi",
        "odeme_tarihi",
      ],
      firstRowKeys,
      hasHeader: false,
      detectedFormat: "eight-column-expense-payment",
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
  const supplier = pick(raw, [
    "kisi",
    "tedarikci",
    "tedarikci_adi",
    "tedarikci_kisi",
    "kisi_tedarikci",
  ]);

  const title = pick(raw, [
    "kayit_ismi",
    "kayit_kalemi",
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

  const paymentAmountRaw = pick(raw, [
    "odeme_tutari",
    "odeme_tutarlari",
    "odeme",
  ]);
  const paymentDateRaw = pick(raw, ["odeme_tarihi", "odenecegi_tarih"]);
  const paymentAccountRaw = pick(raw, [
    "odeme_hesabi",
    "odeme_hesaplari",
    "cikis_hesabi",
    "hesap",
  ]);

  const payments = buildPayments({
    amountRaw: paymentAmountRaw,
    dateRaw: paymentDateRaw,
    accountRaw: paymentAccountRaw,
    description: title,
  });

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
      payments,
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

export function getPaymentRecords(text) {
  const rows = Array.isArray(text) ? text : parseTable(text);
  const records = [];

  rows.forEach((row, rowIndex) => {
    const payments = Array.isArray(row.payments) ? row.payments : [];

    payments.forEach((payment, paymentIndex) => {
      records.push({
        supplier: row.supplier,
        itemName: row.title,
        description: payment.description || row.title,
        amount: payment.amount,
        amountNumber: payment.amountNumber,
        date: payment.date,
        dateText: payment.dateText,
        account: payment.account,
        rowIndex,
        paymentIndex,
        paymentCount: payments.length,
      });
    });
  });

  return records;
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
