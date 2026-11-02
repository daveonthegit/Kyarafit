"use client";

/**
 * Landing motion plumbing (Landing Live spec): ONE throttled scroll rAF
 * handler shared by header-glass, hero zoom/fade, and parallax; ONE
 * IntersectionObserver for section reveals. Everything is gated behind
 * prefers-reduced-motion at the call sites.
 */

type ScrollFn = (y: number) => void;

const scrollSubs = new Set<ScrollFn>();
let scrollAttached = false;
let ticking = false;

function dispatch() {
  const y = window.scrollY;
  scrollSubs.forEach((fn) => fn(y));
  ticking = false;
}

function onScroll() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(dispatch);
  }
}

/** Subscribe to the shared scroll loop. Returns an unsubscribe fn. */
export function onLandingScroll(fn: ScrollFn): () => void {
  scrollSubs.add(fn);
  if (!scrollAttached) {
    window.addEventListener("scroll", onScroll, { passive: true });
    scrollAttached = true;
  }
  fn(window.scrollY);
  return () => {
    scrollSubs.delete(fn);
  };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

let revealObserver: IntersectionObserver | null = null;

/**
 * Register an element for the reveal transition (`.landing-reveal` in
 * globals.css). Fires once when ~20% enters the viewport; siblings stagger
 * via `style.transitionDelay` set by the caller. Under reduced motion the
 * element resolves to its final state immediately.
 */
export function observeReveal(el: HTMLElement | null): void {
  if (!el) return;
  if (prefersReducedMotion()) {
    el.classList.add("is-visible");
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 }
    );
  }
  revealObserver.observe(el);
}
