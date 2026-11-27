import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Le réglage « réduire les animations » de l'appareil. `null` tant qu'on ne le connaît pas : rien ne bouge.
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => true)
      .then((value) => {
        if (!cancelled) setReduced(value);
      });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      listener.remove();
    };
  }, []);
  return reduced;
};
