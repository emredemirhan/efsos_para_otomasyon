import test from "node:test";
import assert from "node:assert/strict";
import { parsePaymentItems, paymentItemsTotal } from "../src/core/paymentParser.js";
import { parseTable } from "../src/core/tableParser.js";

test("parseTable reads header-based pasted Excel rows", () => {
  const rows = parseTable(
    [
      "Toplam Tutar\tTedarikçi\tKayıt İsmi\tMarka\tFiş/Fatura Tarihi\tÖdeneceği Tarih\tEtiket",
      "1.234,56\tABC LTD\tGoogle Ads\tReklam\t01.05.2026\t05.06.2026\tMüşteri A",
    ].join("\n"),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, "1.234,56");
  assert.equal(rows[0].supplier, "ABC LTD");
  assert.equal(rows[0].title, "Google Ads");
  assert.equal(rows[0].brand, "Reklam");
  assert.equal(rows[0].tag, "Müşteri A");
});

test("parseTable reads fixed-order rows without headers", () => {
  const rows = parseTable("2500\tXYZ AŞ\tHosting\tYazılım\t02.05.2026\t05.06.2026\tOperasyon");

  assert.equal(rows.length, 1);
  assert.equal(rows[0].supplier, "XYZ AŞ");
  assert.equal(rows[0].brand, "Yazılım");
});

test("parsePaymentItems extracts multiline payment rows", () => {
  const items = parsePaymentItems({
    title: "Meta - 100,50 TL\nGoogle - 200 TL",
    amount: "300,50",
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].description, "Meta");
  assert.equal(items[0].amount, 100.5);
  assert.equal(paymentItemsTotal(items), 300.5);
});
