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
  const trDatePattern = new RegExp(
    "^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})$",
  );
  const isoDatePattern = new RegExp("^(\\d{4})-(\\d{1,2})-(\\d{1,2})$");

  if (excelDatePattern.test(raw)) {
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + Number(raw));
    return d;
  }

  const tr = raw.match(trDatePattern);
  if (tr) {
    return new Date(Number(tr[3]), Number(tr[2]) - 1, Number(tr[1]));
  }

  const iso = raw.match(isoDatePattern);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
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
