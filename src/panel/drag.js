import { savePanelPosition } from "./storage.js";

export function makePanelDraggable(panel, handle) {
  let dragging = false;
  let frameId = 0;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let currentLeft = 0;
  let currentTop = 0;

  function applyDragTransform() {
    frameId = 0;

    const translateX = currentLeft - startLeft;
    const translateY = currentTop - startTop;

    panel.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
  }

  function scheduleDragTransform() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(applyDragTransform);
  }

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
    currentLeft = startLeft;
    currentTop = startTop;

    panel.style.left = `${startLeft}px`;
    panel.style.top = `${startTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "translate3d(0, 0, 0)";
    panel.style.willChange = "transform";

    document.body.style.userSelect = "none";
    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!dragging) return;

    const maxLeft = window.innerWidth - 80;
    const maxTop = window.innerHeight - 50;

    currentLeft = Math.max(
      0,
      Math.min(startLeft + event.clientX - startX, maxLeft),
    );
    currentTop = Math.max(
      0,
      Math.min(startTop + event.clientY - startY, maxTop),
    );

    scheduleDragTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;

    dragging = false;

    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    panel.style.transform = "";
    panel.style.willChange = "";
    panel.style.left = `${currentLeft}px`;
    panel.style.top = `${currentTop}px`;
    document.body.style.userSelect = "";
    savePanelPosition(panel, { left: currentLeft, top: currentTop });
  });
}
