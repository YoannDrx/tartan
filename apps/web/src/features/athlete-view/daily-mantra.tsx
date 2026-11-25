"use client";

import { dailyMantra, type EncouragementTone } from "@tartan/i18n";
import { useEffect, useState } from "react";

export function DailyMantra({ tone, initial }: { tone?: EncouragementTone; initial: string | null }) {
  const [message, setMessage] = useState(initial);
  useEffect(() => {
    const refresh = () => setMessage(dailyMantra(tone));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tone]);
  return message ? <p className="text-soft">{message}</p> : null;
}
