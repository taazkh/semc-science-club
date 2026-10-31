export const initialLoadingBootstrap = `(function(){var h=document.documentElement;try{var p=location.pathname;if(p!=='/'&&p!=='/stemfest'&&p.indexOf('/stemfest/')!==0)return;h.dataset.initialLoading='true';setTimeout(function(){if(!h.dataset.initialLoading)return;delete h.dataset.initialLoading;window.dispatchEvent(new Event('semc-initial-loading-complete'))},12000)}catch(e){delete h.dataset.initialLoading}})();`;

export function firstViewReady() {
  if (!document.querySelector("main h1")) return false;
  const scene = document.querySelector("[data-scene-state]");
  if (scene?.getAttribute("data-scene-state") === "pending") return false;
  const inView = (node: Element) => {
    const bounds = node.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 &&
      bounds.top < innerHeight && bounds.bottom > 0;
  };
  return Array.from(document.querySelectorAll("[data-reveal]"))
    .filter(inView)
    .every((node) => node.getAttribute("data-reveal-owned") === "true") &&
    Array.from(document.querySelectorAll(".stroke-text"))
      .filter(inView)
      .every((node) => node.getAttribute("data-ready") === "true");
}
