import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "../src/core/format.js";
import { inspectTableParse, parseTable } from "../src/core/tableParser.js";

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

test("parseTable reads the multi-row five-column Excel paste", () => {
  const sample = [
    "EDA DEDE\tASTRA ZENECA\t75.000,00\t75.000,00\tSOLUNUM EOS AKADEMİ FİLM 45 SN",
    "EGEMEN ÖKTEM PRODÜKSİYON\tGSK\t3.600,00\t3.600,00\t14 MAYIS GSK ZONA ADBOARD TOPLANTI SES KAYIT CİHAZI KİRALAMA 3 GÜN",
    "ÖMER FATİH KARAKAŞ MEDİKAL\tASTRA ZENECA\t4.000,00\t4.000,00\tSOLUNUM REFERANS KONTROLÜ 10 SAYFA",
    "ZİKRİ KAYA MEDİKAL (NİL ÇEVİRİ)\tGSK\t65.000,00\t65.000,00\tZAFER KURUGÖL VİDEOLARI DEŞİFRASYON & REFERANSLANDIRMA 17 ADET * 3 DAKİKA",
    "NİL ÖZAKIN MEDİKAL\tGSK\t63.000,00\t63.000,00\tVAKA PLATFORMU: 11 VAKANIN HEKİM & HASTA GÖZÜNDEN VAKA KILAVUZUNUN HAZIRLANMASI + REFERANSLANDIRILMASI",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t21.000,00\tZONA İNFOGRAİK FİLM AKIŞLARI + MAİLİNGLER 3 ADET",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t1.000,00\tSHİNGRİX ZONA ÖZEL GÜN HEKİM MAİLİNG - KALP YETERSİZLİĞİ FARKINDALIK GÜNÜ 1 ADET",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t2.000,00\tLAMİCTAL 30. YIL FİLMİ CLAİM REVİZE & EKLEME - REFERANSLANDIRMA",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t20.000,00\tZONA HEKİM BİLİNÇLENDİRME ÇALIŞMALARI - VAKA AKIŞI OLUŞTURMA (endo-nefro) 2 ADET",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t750,00\tDİJM DERMA PORTFÖY MAİLİNG REVİZELER VE REFERANSLANDIRMA  1 ADET",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t28.000,00\tRSV İNFOGRAFIK FİLM AKIŞLARI + MAILINGLER - 4 ADET",
    "OYA KADAİFCİ - MEDİKAL\tGSK\t82.750,00\t10.000,00\tZONA HEKİM BİLİNÇLENDİRME ÇALIŞMALARI - VAKA AKIŞI OLUŞTURMA (kardiyo) 1 ADET",
    "MERTCAN ATİK VİDEO\tGSK\t40.000,00\t15.000,00\tGSK AŞI HASTASI VİDEO ÇALIŞMASI STOK GÖRSELLİ MÜZİKLİ 30 SANİYE",
    "MERTCAN ATİK VİDEO\tGSK\t40.000,00\t8.000,00\tGSK AŞI HAFTASI KOLAJ VİDEO 30 SANİYE 1 ADET",
    "MERTCAN ATİK VİDEO\tASTRA ZENECA\t40.000,00\t3.000,00\tSOLUNUM EOS AKADEMİ TEASER 15 SANİYE 1 ADET",
    "MERTCAN ATİK VİDEO\tGSK\t40.000,00\t5.000,00\tGSK AŞI AŞI HAFTASI SM POST ÇALIŞMALARI ANİMAAYON MÜZİK 10-12 SANİYE 2 ADET",
    "MERTCAN ATİK VİDEO\tCENTURİON\t40.000,00\t9.000,00\tCENTURİON INFLUVİRAN KONSEPT TANITIM GIF VIDEO",
  ].join("\n");

  const rows = parseTable(sample);
  const debug = inspectTableParse(sample);

  assert.equal(rows.length, 17);
  assert.equal(rows[0].supplier, "EDA DEDE");
  assert.equal(rows[0].brand, "ASTRA ZENECA");
  assert.equal(rows[0].amount, "75.000,00");
  assert.equal(rows[16].brand, "CENTURİON");
  assert.equal(debug.detectedFormat, "five-column-expense");
  assert.equal(debug.acceptedCount, 17);
  assert.equal(debug.rejectedCount, 0);
  assert.equal(debug.firstRowColumnCount, 5);
});
