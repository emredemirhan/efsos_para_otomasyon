import test from "node:test";
import assert from "node:assert/strict";
import { formatDateTR, parseAmount } from "../src/core/format.js";
import {
  getPaymentRecords,
  getSalaryPaymentRecords,
  getSalaryRecords,
  inspectTableParse,
  parseTable,
} from "../src/core/tableParser.js";

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

test("parseTable reads the seven-column expense+payment format", () => {
  const rows = parseTable(
    "NİL ÖZAKIN MEDİKAL\tGSK\t63.000,00\tVAKA PLATFORMU HAZIRLANMASI\t63.000,00\tZİRAAT AJANS A.Ş. TL (5004)\t05.06.2026",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].supplier, "NİL ÖZAKIN MEDİKAL");
  assert.equal(rows[0].title, "VAKA PLATFORMU HAZIRLANMASI");
  assert.equal(rows[0].payments.length, 1);
  assert.equal(rows[0].payments[0].amount, "63.000,00");
  assert.equal(rows[0].payments[0].account, "ZİRAAT AJANS A.Ş. TL (5004)");
  assert.equal(formatDateTR(rows[0].payments[0].date), "05.06.2026");
  assert.equal(rows[0].payments[0].description, "VAKA PLATFORMU HAZIRLANMASI");
});

test("parseTable reads headerless eight-column rows (account before date)", () => {
  const rows = parseTable(
    "EDA DEDE\tASTRA ZENECA\t75.000,00\t75.000,00\tSOLUNUM EOS AKADEMİ FİLM 45 SN\t75.000,00\tEV TL\t5.06.2026",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].supplier, "EDA DEDE");
  assert.equal(rows[0].payments.length, 1);
  assert.equal(rows[0].payments[0].amount, "75.000,00");
  assert.equal(rows[0].payments[0].account, "EV TL");
  assert.equal(formatDateTR(rows[0].payments[0].date), "05.06.2026");
});

test("buildPayments splits multiple payments by slash and zips date/account", () => {
  const rows = parseTable(
    [
      "Tedarikçi\tMarka\tKalem Tutarı\tKayıt İsmi\tÖdeme Tutarı\tÖdeme Tarihi\tÖdeme Hesabı",
      "OYA KADAİFCİ\tGSK\t82.750,00\tZONA İNFOGRAFİK\t30.000,00 / 52.750,00\t05.06.2026 / 20.06.2026\tEV TL / GARANTİ ÖZGE TL",
    ].join("\n"),
  );

  const [row] = rows;
  assert.equal(row.payments.length, 2);
  assert.equal(row.payments[0].amount, "30.000,00");
  assert.equal(formatDateTR(row.payments[0].date), "05.06.2026");
  assert.equal(row.payments[0].account, "EV TL");
  assert.equal(row.payments[1].amount, "52.750,00");
  assert.equal(formatDateTR(row.payments[1].date), "20.06.2026");
  assert.equal(row.payments[1].account, "GARANTİ ÖZGE TL");
});

test("buildPayments applies single date/account to all amounts", () => {
  const rows = parseTable(
    [
      "Tedarikçi\tMarka\tKalem Tutarı\tKayıt İsmi\tÖdeme Tutarı\tÖdeme Tarihi\tÖdeme Hesabı",
      "OYA KADAİFCİ\tGSK\t82.750,00\tZONA İNFOGRAFİK\t30.000,00 / 52.750,00\t05.06.2026\tEV TL",
    ].join("\n"),
  );

  const [row] = rows;
  assert.equal(row.payments.length, 2);
  assert.equal(formatDateTR(row.payments[0].date), "05.06.2026");
  assert.equal(formatDateTR(row.payments[1].date), "05.06.2026");
  assert.equal(row.payments[0].account, "EV TL");
  assert.equal(row.payments[1].account, "EV TL");
});

test("getPaymentRecords flattens rows into one record per payment", () => {
  const sample = [
    "Tedarikçi\tMarka\tKalem Tutarı\tKayıt İsmi\tÖdeme Tutarı\tÖdeme Tarihi\tÖdeme Hesabı",
    "NİL ÖZAKIN\tGSK\t63.000,00\tVAKA PLATFORMU\t63.000,00\t05.06.2026\tEV TL",
    "OYA KADAİFCİ\tGSK\t82.750,00\tZONA İNFOGRAFİK\t30.000,00 / 52.750,00\t05.06.2026 / 20.06.2026\tEV TL / GARANTİ ÖZGE TL",
  ].join("\n");

  const records = getPaymentRecords(sample);

  assert.equal(records.length, 3);
  assert.equal(records[0].supplier, "NİL ÖZAKIN");
  assert.equal(records[0].itemName, "VAKA PLATFORMU");
  assert.equal(records[0].description, "VAKA PLATFORMU");
  assert.equal(records[1].itemName, "ZONA İNFOGRAFİK");
  assert.equal(records[1].paymentIndex, 0);
  assert.equal(records[1].paymentCount, 2);
  assert.equal(records[2].amount, "52.750,00");
  assert.equal(records[2].account, "GARANTİ ÖZGE TL");
});

test("getPaymentRecords reads compact Turkish payment dates", () => {
  const sample = [
    "Tedarikçi\tMarka\tKalem Tutarı\tKayıt İsmi\tÖdeme Tutarı\tÖdeme Tarihi\tÖdeme Hesabı",
    "NİL ÖZAKIN\tGSK\t63.000,00\tVAKA PLATFORMU\t63.000,00\t0605-2026\tEV TL",
  ].join("\n");

  const [record] = getPaymentRecords(sample);

  assert.equal(record.dateText, "0605-2026");
  assert.equal(formatDateTR(record.date), "06.05.2026");
});

test("getSalaryRecords reads header-based salary expense rows", () => {
  const sample = [
    "Çalışan\tKayıt İsmi\tHak Ediş Tarihi\tToplam Tutar\tÖdeneceği Tarih",
    "Emre Demirhan\t2026 Haziran maaşı\t30.06.2026\t120.000,00\t05.07.2026",
  ].join("\n");

  const [record] = getSalaryRecords(sample);

  assert.equal(record.employee, "Emre Demirhan");
  assert.equal(record.title, "2026 Haziran maaşı");
  assert.equal(record.amount, "120.000,00");
  assert.equal(record.category, "maaş");
  assert.equal(record.entitlementDateText, "30.06.2026");
  assert.equal(formatDateTR(record.entitlementDate), "30.06.2026");
  assert.equal(record.dueDateText, "05.07.2026");
  assert.equal(formatDateTR(record.dueDate), "05.07.2026");
});

test("getSalaryRecords ignores regular expense rows without salary dates", () => {
  const records = getSalaryRecords(
    "YASİN ZENGİN\tHALEON\t2.250,00\tHALEON VOLTAREN PPT SUNUM 9 SYF",
  );

  assert.equal(records.length, 0);
});

test("getSalaryPaymentRecords reads separate salary payment column groups", () => {
  const sample = [
    [
      "Çalışan",
      "Kayıt İsmi",
      "Hak Ediş Tarihi",
      "Toplam Tutar",
      "Ödeneceği Tarih",
      "Ana Maaş Ödeme Tarihi",
      "Ana Maaş Ödeme Hesabı",
      "Ana Maaş Ödeme Tutarı",
      "Ana Maaş Ödeme Açıklaması",
      "BES Ödeme Tarihi",
      "BES Ödeme Hesabı",
      "BES Ödeme Tutarı",
      "BES Ödeme Açıklaması",
      "Kalan Maaş Ödeme Tarihi",
      "Kalan Maaş Ödeme Hesabı",
      "Kalan Maaş Ödeme Tutarı",
      "Kalan Maaş Ödeme Açıklaması",
    ].join("\t"),
    [
      "Emre Demirhan",
      "2026 Mayıs maaşı",
      "31.05.2026",
      "90.000,00",
      "05.06.2026",
      "05.06.2026",
      "EV TL",
      "50.000,00",
      "2026 Mayıs maaş",
      "10.06.2026",
      "BES TL",
      "10.000,00",
      "2026 Mayıs BES",
      "20.06.2026",
      "GARANTİ TL",
      "30.000,00",
      "2026 Mayıs kalan maaş",
    ].join("\t"),
  ].join("\n");

  const records = getSalaryPaymentRecords(sample);

  assert.equal(records.length, 3);
  assert.equal(records[0].employee, "Emre Demirhan");
  assert.equal(records[0].paymentKind, "Ana Maaş");
  assert.equal(formatDateTR(records[0].date), "05.06.2026");
  assert.equal(records[0].account, "EV TL");
  assert.equal(records[0].amount, "50.000,00");
  assert.equal(records[0].description, "2026 Mayıs maaş");
  assert.equal(records[1].paymentKind, "BES");
  assert.equal(records[1].account, "BES TL");
  assert.equal(records[2].paymentKind, "Kalan Maaş");
  assert.equal(records[2].amount, "30.000,00");
});

test("getSalaryPaymentRecords skips empty salary payment groups", () => {
  const sample = [
    [
      "Çalışan",
      "Kayıt İsmi",
      "Hak Ediş Tarihi",
      "Toplam Tutar",
      "Ödeneceği Tarih",
      "Ana Maaş Ödeme Tarihi",
      "Ana Maaş Ödeme Hesabı",
      "Ana Maaş Ödeme Tutarı",
      "Ana Maaş Ödeme Açıklaması",
      "BES Ödeme Tarihi",
      "BES Ödeme Hesabı",
      "BES Ödeme Tutarı",
      "BES Ödeme Açıklaması",
      "Kalan Maaş Ödeme Tarihi",
      "Kalan Maaş Ödeme Hesabı",
      "Kalan Maaş Ödeme Tutarı",
      "Kalan Maaş Ödeme Açıklaması",
    ].join("\t"),
    [
      "Emre Demirhan",
      "2026 Mayıs maaşı",
      "31.05.2026",
      "90.000,00",
      "05.06.2026",
      "05.06.2026",
      "EV TL",
      "90.000,00",
      "2026 Mayıs maaş",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join("\t"),
  ].join("\n");

  const records = getSalaryPaymentRecords(sample);

  assert.equal(records.length, 1);
  assert.equal(records[0].paymentKind, "Ana Maaş");
  assert.equal(records[0].amount, "90.000,00");
});
