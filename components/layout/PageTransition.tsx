"use client";

import { AnimatePresence, motion, useIsPresent, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

const DURATION = 0.35;
const EASE = "easeInOut" as const;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

// Reimplemented instead of framer-motion's useReducedMotion(), which reads matchMedia
// synchronously on the client's first render and can mismatch the server's (window-less)
// render. useSyncExternalStore is the SSR-safe way to read this: React forces the first
// client render to match the server snapshot (false), then corrects to the real value
// right after hydration — before any transition has had a chance to run anyway.
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

const enterVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: DURATION, ease: EASE } },
  // No visual change of its own — this just keeps the element mounted for DURATION so
  // the split halves below (which inherit this "exit" state) have time to animate.
  exit: { opacity: 1, transition: { duration: DURATION, ease: EASE } },
};

const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// Renders `children` exactly once for the entire lifetime of this route instance —
// entering, current, and exiting. Nothing here ever mounts a second copy of it, so an
// effect inside children (e.g. a page's on-mount data fetch) only ever runs once, not
// once per "half" of a split-apart effect. The earlier version duplicated `children`
// into two clipped halves during exit, which meant a fresh, independent copy of the
// whole page tree mounted for that ~350ms window — including its own data-fetching
// effects, doubling API calls on every navigation. The "splits in two" look now comes
// from two empty, background-colored panels layered on top that grow out from the
// center to cover the (separately fading + shrinking) content underneath — no content
// duplication involved.
function SplittingRoute({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();

  return (
    <>
      <motion.div
        animate={isPresent ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
        transition={{ duration: DURATION, ease: EASE }}
      >
        {children}
      </motion.div>

      {!isPresent && (
        <>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: DURATION, ease: EASE }}
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 origin-right bg-background"
          />
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: DURATION, ease: EASE }}
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 origin-left bg-background"
          />
        </>
      )}
    </>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = usePrefersReducedMotion();

  if (reduceMotion) {
    return (
      <div className="relative flex-1">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={pathname}
            variants={reducedMotionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 overflow-y-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={pathname}
          variants={enterVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 overflow-y-auto"
        >
          <SplittingRoute>{children}</SplittingRoute>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
