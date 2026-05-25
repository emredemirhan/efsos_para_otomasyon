import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "../src/core/format.js";
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

test("parseTable reads the four-column Excel format as expense rows", () => {
  const rows = parseTable(
    [
      "YASİN ZENGİN\tHALEON\t2.250,00\tHALEON VOLTAREN PPT SUNUM 9 SYF",
      "MERTCAN ATİK\tGSK\t4.000,00\tGSK DİJM DERMA PORTFÖY GIF ANİMASYON",
      "MERTCAN ATİK\tGSK\t3.000,00\tGSK SHİNGRİX RAMAZAN BAYRAMI GİF ANİMASYON",
      "MERTCAN ATİK\tGSK\t3.000,00\tAZ MEME KANSERİ KONKUR GİF ANİMASYON",
      "REYHAN COŞKUN\t\t13.800,00\tTAKEDA NİNLARO CLM SET AKIŞ 46 SYF*300 TL",
    ].join("\n"),
  );

  assert.equal(rows.length, 5);
  assert.equal(rows[1].supplier, "MERTCAN ATİK");
  assert.equal(rows[1].brand, "GSK");
  assert.equal(rows[1].amount, "4.000,00");
  assert.equal(rows[1].title, "GSK DİJM DERMA PORTFÖY GIF ANİMASYON");
  assert.equal(parseAmount(rows[1].amount), 4000);
  assert.equal(rows[3].brand, "GSK");
  assert.equal(rows[3].rawBrand, "GSK");
  assert.equal(rows[4].brand, "");
  assert.equal(rows[4].rawBrand, "");
});

test("parseTable does not infer category from the description column", () => {
  const rows = parseTable(
    "MERTCAN ATİK\tGSK\t10.000,00\t4.000,00\tAZ MEME KANSERİ KONKUR GİF ANİMASYON",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].brand, "GSK");
  assert.equal(rows[0].rawBrand, "GSK");
  assert.equal(rows[0].title, "AZ MEME KANSERİ KONKUR GİF ANİMASYON");
});

test("parseTable still parses the legacy five-column Excel format", () => {
  const rows = parseTable(
    "MERTCAN ATİK\tGSK\t10.000,00\t4.000,00\tGSK DİJM DERMA PORTFÖY",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].supplier, "MERTCAN ATİK");
  assert.equal(rows[0].brand, "GSK");
  assert.equal(rows[0].amount, "4.000,00");
  assert.equal(rows[0].title, "GSK DİJM DERMA PORTFÖY");
});
