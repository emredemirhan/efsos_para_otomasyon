import {
  STORAGE_INDEX_KEY,
  STORAGE_MIN_KEY,
  STORAGE_POS_KEY,
  STORAGE_SALARY_MODE_KEY,
} from "../config/constants.js";

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
