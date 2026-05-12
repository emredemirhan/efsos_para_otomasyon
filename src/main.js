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

  const refreshPanel = (reason = "refresh") => {
    if (!shouldRunInThisFrame()) {
      removePanel("wrong-frame");
      return;
    }

    ensurePanelForCurrentPage(reason);
  };

  const scheduleRefreshPanel = (reason = "scheduled") => {
    window.setTimeout(() => refreshPanel(`${reason}:0ms`), 0);
    window.setTimeout(() => refreshPanel(`${reason}:300ms`), 300);
    window.setTimeout(() => refreshPanel(`${reason}:1000ms`), 1000);
  };

  const patchHistoryMethod = (methodName) => {
    const original = window.history[methodName];
    if (typeof original !== "function") return;

    window.history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new CustomEvent(ROUTE_REFRESH_EVENT, {
        detail: { methodName },
      }));
      return result;
    };
  };

  const watchSpaNavigation = () => {
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");

    window.addEventListener("popstate", () => scheduleRefreshPanel("popstate"));
    window.addEventListener("hashchange", () => scheduleRefreshPanel("hashchange"));
    window.addEventListener(ROUTE_REFRESH_EVENT, (event) =>
      scheduleRefreshPanel(`history:${event.detail?.methodName || "unknown"}`),
    );

    const observer = new MutationObserver(() => {
      if (!document.body || document.querySelector("#ajans-gider-panel")) return;
      scheduleRefreshPanel("panel-missing-after-dom-mutation");
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  const boot = () => {
    console.log("[AJANS] Script çalıştı:", location.href);

    refreshPanel("boot");
    watchSpaNavigation();

    window.addEventListener("resize", keepPanelInViewport);
    window.setInterval(() => refreshPanel("interval"), 1500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
