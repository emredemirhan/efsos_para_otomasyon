import {
  STORAGE_ACTIVE_FLOW_KEY,
  STORAGE_INDEX_KEY,
  STORAGE_MIN_KEY,
  STORAGE_PENDING_EXPENSE_KEY,
  STORAGE_POS_KEY,
  STORAGE_SALARY_MODE_KEY,
} from "../config/constants.js";

const ACTIVE_FLOWS = ["expense", "payment", "salary"];
const PENDING_EXPENSE_MAX_AGE_MS = 5 * 60 * 1000;

export function getActiveFlow(fallback = "idle") {
  const savedFlow = localStorage.getItem(STORAGE_ACTIVE_FLOW_KEY);

  if (ACTIVE_FLOWS.includes(savedFlow)) return savedFlow;
  if (!ACTIVE_FLOWS.includes(fallback)) return "idle";

  setActiveFlow(fallback);
  return fallback;
}

export function setActiveFlow(flow) {
  if (!ACTIVE_FLOWS.includes(flow)) return;

  localStorage.setItem(STORAGE_ACTIVE_FLOW_KEY, flow);
}

export function getPendingExpenseFill() {
  try {
    const pending = JSON.parse(
      localStorage.getItem(STORAGE_PENDING_EXPENSE_KEY) || "null",
    );
    const isValidIndex = Number.isInteger(pending?.index) && pending.index >= 0;
    const isFresh =
      Date.now() - Number(pending?.createdAt || 0) <
      PENDING_EXPENSE_MAX_AGE_MS;

    if (isValidIndex && isFresh) return pending;
  } catch {}

  clearPendingExpenseFill();
  return null;
}

export function setPendingExpenseFill(index) {
  localStorage.setItem(
    STORAGE_PENDING_EXPENSE_KEY,
    JSON.stringify({ index, createdAt: Date.now() }),
  );
}

export function clearPendingExpenseFill() {
  localStorage.removeItem(STORAGE_PENDING_EXPENSE_KEY);
}

export function getSavedPanelPosition() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_POS_KEY) || "null");
  } catch {
    return null;
  }
}

export function savePanelPosition(panel, position = null) {
  const rect = position || panel.getBoundingClientRect();

  localStorage.setItem(
    STORAGE_POS_KEY,
    JSON.stringify({
      left: Math.round(rect.left),
      top: Math.round(rect.top),
    }),
  );
}

export function getSafePanelPosition() {
  const saved = getSavedPanelPosition();

  if (!saved) return null;

  const left = Math.max(
    0,
    Math.min(Number(saved.left) || 24, window.innerWidth - 120),
  );
  const top = Math.max(
    0,
    Math.min(Number(saved.top) || 110, window.innerHeight - 80),
  );

  return { left, top };
}

export function getSelectedIndex(rowsLength) {
  const raw = Number(localStorage.getItem(STORAGE_INDEX_KEY) || 0);

  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw >= rowsLength) return Math.max(0, rowsLength - 1);

  return raw;
}

export function setSelectedIndex(index) {
  localStorage.setItem(STORAGE_INDEX_KEY, String(index));
}

export function clearSelectionState() {
  localStorage.removeItem(STORAGE_INDEX_KEY);
}

export function getSalaryMode() {
  const value = localStorage.getItem(STORAGE_SALARY_MODE_KEY);

  return ["expense", "main-bes", "remaining"].includes(value) ? value : "expense";
}

export function setSalaryMode(mode) {
  const safeMode = ["expense", "main-bes", "remaining"].includes(mode)
    ? mode
    : "expense";

  localStorage.setItem(STORAGE_SALARY_MODE_KEY, safeMode);
}

export function isPanelMinimized() {
  return localStorage.getItem(STORAGE_MIN_KEY) === "1";
}

export function setPanelMinimized(minimized) {
  localStorage.setItem(STORAGE_MIN_KEY, minimized ? "1" : "0");
}
