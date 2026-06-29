import test from "node:test";
import assert from "node:assert/strict";
import { buildNewExpensePath } from "../src/parasut/expenseNavigation.js";

test("buildNewExpensePath preserves the company prefix from a bill detail page", () => {
  assert.equal(
    buildNewExpensePath("/12345/fis-faturalar/98765"),
    "/12345/fis-faturalar/yeni",
  );
});

test("buildNewExpensePath works from every supported flow page", () => {
  assert.equal(
    buildNewExpensePath("/12345/fis-faturalar"),
    "/12345/fis-faturalar/yeni",
  );
  assert.equal(
    buildNewExpensePath("/12345/tedarikciler/98765"),
    "/12345/fis-faturalar/yeni",
  );
  assert.equal(
    buildNewExpensePath("/12345/calisanlar/98765"),
    "/12345/fis-faturalar/yeni",
  );
  assert.equal(buildNewExpensePath("/12345/ayarlar"), "");
});
