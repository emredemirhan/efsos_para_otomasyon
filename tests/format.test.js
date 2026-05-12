import test from "node:test";
import assert from "node:assert/strict";
import { formatAmountTR, formatDateTR, parseAmount, parseDate } from "../src/core/format.js";

test("parseAmount handles Turkish money formats", () => {
  assert.equal(parseAmount("1.234,56 TL"), 1234.56);
  assert.equal(parseAmount("1234,56"), 1234.56);
  assert.equal(parseAmount("1.234"), 1234);
});

test("formatAmountTR formats with two decimals", () => {
  assert.equal(formatAmountTR("1234,5"), "1.234,50");
});

test("parseDate handles Excel, TR, and ISO dates", () => {
  assert.equal(formatDateTR(parseDate("01.05.2026")), "01.05.2026");
  assert.equal(formatDateTR(parseDate("2026-05-01")), "01.05.2026");
  assert.equal(formatDateTR(parseDate("45000")), "15.03.2023");
});
