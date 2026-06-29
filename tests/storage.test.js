import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_ACTIVE_FLOW_KEY,
  STORAGE_PENDING_EXPENSE_KEY,
} from "../src/config/constants.js";
import {
  getActiveFlow,
  getPendingExpenseFill,
  setActiveFlow,
  setPendingExpenseFill,
} from "../src/panel/storage.js";

function createLocalStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("getActiveFlow initializes from the first relevant page and keeps the selection", () => {
  globalThis.localStorage = createLocalStorage();

  assert.equal(getActiveFlow("expense"), "expense");
  assert.equal(localStorage.getItem(STORAGE_ACTIVE_FLOW_KEY), "expense");

  setActiveFlow("payment");

  assert.equal(getActiveFlow("expense"), "payment");
});

test("getActiveFlow ignores unsupported stored and selected values", () => {
  globalThis.localStorage = createLocalStorage();
  localStorage.setItem(STORAGE_ACTIVE_FLOW_KEY, "unknown");

  assert.equal(getActiveFlow("idle"), "idle");

  setActiveFlow("salary");
  setActiveFlow("unknown");
  assert.equal(localStorage.getItem(STORAGE_ACTIVE_FLOW_KEY), "salary");
  assert.equal(getActiveFlow("expense"), "salary");
});

test("pending expense fill survives navigation and expires safely", () => {
  globalThis.localStorage = createLocalStorage();
  const originalNow = Date.now;

  try {
    Date.now = () => 1_000_000;
    setPendingExpenseFill(4);
    assert.deepEqual(getPendingExpenseFill(), {
      index: 4,
      createdAt: 1_000_000,
    });

    Date.now = () => 1_000_000 + 5 * 60 * 1000;
    assert.equal(getPendingExpenseFill(), null);
    assert.equal(localStorage.getItem(STORAGE_PENDING_EXPENSE_KEY), null);
  } finally {
    Date.now = originalNow;
  }
});
