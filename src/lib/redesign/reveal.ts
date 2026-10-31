"use client";
import { useLayoutEffect, type RefObject } from "react";

export function claimReveal(
  node: Element & { dataset: DOMStringMap },
  reduced: boolean,
) {
  node.dataset.revealOwned = "true";
  if (
    reduced ||
    typeof node.animate !== "function" ||
    typeof IntersectionObserver !== "function"
  ) {
    node.dataset.reveal = "complete";
    return false;
  }
  // The loading watchdog exposes content after five seconds. Once this
  // controller arrives, recover future reveals instead of disabling the visit.
  document.documentElement.dataset.motion = "enhanced";
  document.documentElement.dataset.motionReady = "true";
  if (
    node.dataset.reveal === "complete" ||
    (node.dataset.reveal === "bypass" &&
      !document.documentElement.dataset.initialLoading &&
      node.getBoundingClientRect().top < innerHeight)
  ) {
    // Do not hide content the reader could already see during the fallback.
    node.dataset.reveal = "complete";
    return false;
  }
  node.dataset.reveal = "pending";
  return true;
}

export function useReveal<T extends Element>(
  ref: RefObject<T | null>,
  prepare: (element: T) => Animation[],
  threshold = 0.18,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const node = element as T & { dataset: DOMStringMap };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (!claimReveal(node, media.matches)) return;
    let animations: Animation[] = [],
      visible = false,
      started = false;
    let observer: IntersectionObserver | undefined;
    const finish = () => {
      animations.forEach((a) => a.cancel());
      node.dataset.reveal = "complete";
      observer?.disconnect();
    };
    try {
      animations = prepare(element);
      animations.forEach((a) => {
        a.pause();
        a.currentTime = 0;
      });
    } catch {
      finish();
      return;
    }
    const sync = () => {
      if (node.dataset.reveal === "complete") return;
      if (visible && !document.hidden &&
          !document.documentElement.dataset.initialLoading) {
        started = true;
        node.dataset.reveal = "running";
        animations.forEach((a) => {
          if (a.playState !== "finished") a.play();
        });
      } else
        animations.forEach((a) => {
          if (a.playState !== "finished") a.pause();
        });
    };
    observer = new IntersectionObserver(
      ([entry]) => {
        visible =
          entry.isIntersecting &&
          (started ||
            entry.intersectionRect.height >=
              Math.min(entry.boundingClientRect.height, innerHeight) * threshold);
        sync();
      },
      { threshold: [0, 0.1, 0.18, 0.25, 0.35, 0.5, 0.75, 1] },
    );
    observer.observe(element);
    Promise.all(animations.map((a) => a.finished))
      .then(() => {
        if (started) finish();
      })
      .catch(() => {});
    const reduce = () => {
      if (media.matches) finish();
    };
    const focus = (event: Event) => {
      const target = event.target;
      if (
        element.contains(target as Node) ||
        (target instanceof Element &&
          target.matches("a,button,summary,[role='button']") &&
          target.contains(element))
      )
        finish();
    };
    const anchor = () => {
      let target: HTMLElement | null = null;
      try {
        target = document.getElementById(
          decodeURIComponent(location.hash.slice(1)),
        );
      } catch {}
      // Reveal an explicitly targeted island, not every future child of a
      // section hash. Otherwise /stemfest#programme skips each new diagram.
      if (target && element.contains(target)) finish();
    };
    anchor();
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("focusin", focus);
    window.addEventListener("hashchange", anchor);
    window.addEventListener("semc-motion-bypass", finish);
    window.addEventListener("semc-initial-loading-complete", sync);
    window.addEventListener("beforeprint", finish);
    media.addEventListener("change", reduce);
    return () => {
      observer?.disconnect();
      animations.forEach((a) => a.cancel());
      if (node.dataset.reveal === "running") node.dataset.reveal = "pending";
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("focusin", focus);
      window.removeEventListener("hashchange", anchor);
      window.removeEventListener("semc-motion-bypass", finish);
      window.removeEventListener("semc-initial-loading-complete", sync);
      window.removeEventListener("beforeprint", finish);
      media.removeEventListener("change", reduce);
    };
  }, [ref, prepare, threshold]);
}
