import {
  ensurePanelForCurrentPage,
  keepPanelInViewport,
  removePanel,
} from "./panel/controller.js";
import { removeDuplicatePanels, shouldRunInThisFrame } from "./parasut/frame.js";

const ROUTE_REFRESH_EVENT = "ajans:route-refresh";

if (!shouldRunInThisFrame()) {
  console.info("[AJANS] Dış Trinity kabuğunda çalıştırılmadı.");
} else if (window.__AJANS_GIDER_SCRIPT_LOADED__) {
  console.warn("[AJANS] Script zaten yüklenmiş, ikinci çalışma engellendi.");
  removeDuplicatePanels();
} else {
  window.__AJANS_GIDER_SCRIPT_LOADED__ = true;
  removeDuplicatePanels();

  const refreshPanel = () => {
    if (!shouldRunInThisFrame()) {
      removePanel();
      return;
    }

    ensurePanelForCurrentPage();
  };

  const scheduleRefreshPanel = () => {
    window.setTimeout(refreshPanel, 0);
    window.setTimeout(refreshPanel, 300);
    window.setTimeout(refreshPanel, 1000);
  };

  const patchHistoryMethod = (methodName) => {
    const original = window.history[methodName];
    if (typeof original !== "function") return;

    window.history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(ROUTE_REFRESH_EVENT));
      return result;
    };
  };

  const watchSpaNavigation = () => {
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");

    window.addEventListener("popstate", scheduleRefreshPanel);
    window.addEventListener("hashchange", scheduleRefreshPanel);
    window.addEventListener(ROUTE_REFRESH_EVENT, scheduleRefreshPanel);

    const observer = new MutationObserver(() => {
      if (!document.body || document.querySelector("#ajans-gider-panel")) return;
      scheduleRefreshPanel();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  const boot = () => {
    console.log("[AJANS] Script çalıştı:", location.href);

    refreshPanel();
    watchSpaNavigation();

    window.addEventListener("resize", keepPanelInViewport);
    window.setInterval(refreshPanel, 1500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
