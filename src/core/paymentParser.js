import { parseAmount } from "./format.js";

export function parsePaymentItems(row) {
  const lines = String(row?.title || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const amountAtEndPattern =
    /^(.*?)\s*[-–—]\s*([\d.,]+)\s*(?:TL|TRY|₺)?\s*$/i;

  const items = lines
    .map((line) => {
      const match = line.match(amountAtEndPattern);
      if (!match) return null;

      return {
        description: match[1].trim(),
        amount: parseAmount(match[2]),
        raw: line,
      };
    })
    .filter((item) => item && item.amount > 0);

  if (items.length) return items;

  const fallbackAmount = parseAmount(row?.amount);

  if (!fallbackAmount) return [];

  return [
    {
      description: String(row?.title || row?.brand || "Ödeme").trim(),
      amount: fallbackAmount,
      raw: String(row?.title || "").trim(),
    },
  ];
}

export function paymentItemsTotal(items) {
  return items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
}
