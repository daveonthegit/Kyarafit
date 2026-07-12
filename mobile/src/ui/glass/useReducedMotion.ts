import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Mirrors web `prefers-reduced-motion` for glass motion (Ken Burns etc.). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(Boolean(enabled));
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
