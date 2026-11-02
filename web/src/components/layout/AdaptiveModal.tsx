"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";

/**
 * Web-only heavier-glass dialog (ref 13d): bottom sheet on phones (<640px),
 * centered dialog from `sm` up. Same content; only size/position change by
 * viewport. Content renders light-on-glass — use `.glass-field` for inputs and
 * `PhotoPill` for actions.
 *
 * Behaviour: Escape and backdrop click dismiss (unless `closeDisabled`), focus
 * moves into the dialog, Tab is trapped, and focus returns to the opener on
 * close. Dismissals that start inside the dialog (Escape, backdrop, the header
 * close button, or the `close` handed to a render-prop `footer`) play the exit
 * motion first and then call `onClose`, so dialogs whose parent unmounts them on
 * close still animate out.
 *
 * Pass `title` to get the standard serif header + close button and a scrolling
 * body; omit it to render `children` straight into the glass panel (the caller
 * draws its own chrome).
 */

export type AdaptiveModalSize = "md" | "lg" | "2xl";

type AdaptiveModalProps = {
  open: boolean;
  onClose: () => void;
  "aria-labelledby"?: string;
  "aria-label"?: string;
  /** Standard header title (serif italic). Enables the header/body/footer layout. */
  title?: React.ReactNode;
  /** id for the title element; defaults to a generated one. */
  titleId?: string;
  /** Footer row; a function receives the animated `close` for Cancel buttons. */
  footer?: React.ReactNode | ((close: () => void) => React.ReactNode);
  /** Blocks Escape/backdrop/close-button dismissal (e.g. while saving). */
  closeDisabled?: boolean;
  /** Accessible label for the header close button. */
  closeLabel?: string;
  /** Desktop width. Omit for the legacy `sm:max-w-md lg:max-w-lg`. */
  size?: AdaptiveModalSize;
  children: React.ReactNode;
};

const sizeClass: Record<AdaptiveModalSize, string> = {
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-lg",
  "2xl": "sm:max-w-2xl",
};

const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last — only the top one answers Escape / traps Tab. */
const dialogStack: symbol[] = [];

const noopSubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const PHONE_QUERY = "(max-width: 639px)"; // below Tailwind `sm`

function subscribePhone(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(PHONE_QUERY).matches
        : false,
    () => false
  );
}

export function AdaptiveModal({
  open,
  onClose,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
  title,
  titleId,
  footer,
  closeDisabled = false,
  closeLabel = "Close",
  size,
  children,
}: AdaptiveModalProps) {
  const isClient = useIsClient();
  const isPhone = useIsPhone();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const fallbackTitleId = useId();
  const resolvedTitleId = titleId ?? fallbackTitleId;

  // Set when the dismissal started inside the dialog: play the exit, then call onClose.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  }, [onClose, closeDisabled]);

  const visible = open && !leaving;

  const requestClose = useCallback(() => {
    if (closeDisabledRef.current || leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
  }, []);

  const handleExitComplete = useCallback(() => {
    if (!leavingRef.current) return;
    leavingRef.current = false;
    setLeaving(false);
    onCloseRef.current();
  }, []);

  // Escape, Tab trap, focus in/out, and body scroll lock while visible.
  useEffect(() => {
    if (!visible || !isClient) return;
    const token = Symbol("adaptive-modal");
    dialogStack.push(token);
    const isTop = () => dialogStack[dialogStack.length - 1] === token;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const all = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const rendered = all.filter((el) => el.getClientRects().length > 0);
      const focusables = rendered.length > 0 ? rendered : all;
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = dialogStack.indexOf(token);
      if (index !== -1) dialogStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [visible, isClient, requestClose]);

  if (!isClient) return null;

  const backdropTransition: Transition = {
    duration: reduceMotion ? 0.12 : 0.24,
    ease: EASE_OUT_STRONG,
  };

  const structured = title != null;
  // Scale only the structured (titled) dialogs: free-form callers host
  // react-easy-crop, which measures with getBoundingClientRect on mount and
  // would capture a 98%-scaled box.
  const enterScale = structured ? 0.98 : 1;
  const panelMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.12 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : isPhone
      ? {
          initial: { y: "100%" },
          animate: { y: 0, transition: { duration: 0.34, ease: EASE_DRAWER } },
          exit: { y: "100%", transition: { duration: 0.24, ease: EASE_IN } },
        }
      : {
          initial: { opacity: 0, scale: enterScale, y: 8 },
          animate: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.28, ease: EASE_OUT_STRONG },
          },
          exit: {
            opacity: 0,
            scale: enterScale,
            y: 4,
            transition: { duration: 0.18, ease: EASE_IN },
          },
        };

  const labelledBy = ariaLabelledBy ?? (structured ? resolvedTitleId : undefined);
  const widthClass = size ? sizeClass[size] : "sm:max-w-md lg:max-w-lg";
  const footerContent = typeof footer === "function" ? footer(requestClose) : footer;

  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && (
        <div
          key="adaptive-modal"
          className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center sm:p-6"
        >
          <motion.div
            className="absolute inset-0 bg-scrim-dim backdrop-blur-[6px]"
            aria-hidden="true"
            onClick={requestClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
            tabIndex={-1}
            {...panelMotion}
            className={`relative w-full ${widthClass} max-h-[90dvh] min-h-[200px] bg-glass-overlay backdrop-blur-glass-overlay border border-b-0 sm:border-b border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg rounded-t-glass-sheet sm:rounded-glass-overlay focus:outline-none ${
              structured ? "flex flex-col overflow-hidden" : "overflow-auto"
            }`}
          >
            {structured ? (
              <>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-divider-strong py-2 pl-6 pr-3">
                  <h2
                    id={resolvedTitleId}
                    className="min-w-0 truncate py-2 font-serif text-[22px] font-normal italic"
                  >
                    {title}
                  </h2>
                  <button
                    type="button"
                    onClick={requestClose}
                    disabled={closeDisabled}
                    aria-label={closeLabel}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>
                      close
                    </span>
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-[22px]">
                  {children}
                </div>
                {footerContent != null && (
                  <div className="flex shrink-0 gap-2.5 border-t border-glass-divider-strong px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {footerContent}
                  </div>
                )}
              </>
            ) : (
              children
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
