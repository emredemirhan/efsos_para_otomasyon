export function parseAmount(value) {
  if (typeof value === "number") return value;

  const cleaned = String(value || "")
    .replace(/TL/gi, "")
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!cleaned) return 0;

  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, ""));
  }

  return Number(cleaned.replace(/,/g, ""));
}

export function formatAmountTR(value) {
  const number = parseAmount(value);

  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number || 0);
}

export function parseDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const excelDatePattern = new RegExp("^\\d{5}$");
  const slashDatePattern = new RegExp(
    "^(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?$",
  );
  const compactTrDatePattern = new RegExp(
    "^(\\d{2})(\\d{2})[-./](\\d{2}|\\d{4})$",
  );
  const trDatePattern = new RegExp("^(\\d{1,2})[.-](\\d{1,2})[.-](\\d{4})$");
  const isoDatePattern = new RegExp("^(\\d{4})-(\\d{1,2})-(\\d{1,2})$");

  const normalizeYear = (yearText) => {
    if (!yearText) return new Date().getFullYear();
    const year = Number(yearText);
    return year < 100 ? 2000 + year : year;
  };

  const makeDate = (year, month, day) => {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  };

  if (excelDatePattern.test(raw)) {
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + Number(raw));
    return d;
  }

  const iso = raw.match(isoDatePattern);
  if (iso) {
    return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const slash = raw.match(slashDatePattern);
  if (slash) {
    return makeDate(normalizeYear(slash[3]), Number(slash[2]), Number(slash[1]));
  }

  const compactTr = raw.match(compactTrDatePattern);
  if (compactTr) {
    return makeDate(
      normalizeYear(compactTr[3]),
      Number(compactTr[2]),
      Number(compactTr[1]),
    );
  }

  const tr = raw.match(trDatePattern);
  if (tr) {
    return makeDate(Number(tr[3]), Number(tr[2]), Number(tr[1]));
  }

  return null;
}

export function formatDateTR(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();

  return `${d}.${m}.${y}`;
}

export function nextPaymentDate() {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + 1, 5);

  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }

  return d;
}
