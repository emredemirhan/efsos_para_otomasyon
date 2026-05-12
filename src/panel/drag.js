import { savePanelPosition } from "./storage.js";

export function makePanelDraggable(panel, handle) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener("mousedown", (event) => {
    const target = event.target;

    if (
      target.closest("button") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest("input")
    ) {
      return;
    }

    dragging = true;

    const rect = panel.getBoundingClientRect();

    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    panel.style.left = `${startLeft}px`;
    panel.style.top = `${startTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    document.body.style.userSelect = "none";
    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) return;

    const nextLeft = startLeft + event.clientX - startX;
    const nextTop = startTop + event.clientY - startY;

    const maxLeft = window.innerWidth - 80;
    const maxTop = window.innerHeight - 50;

    panel.style.left = `${Math.max(0, Math.min(nextLeft, maxLeft))}px`;
    panel.style.top = `${Math.max(0, Math.min(nextTop, maxTop))}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;

    dragging = false;
    document.body.style.userSelect = "";
    savePanelPosition(panel);
  });
}
