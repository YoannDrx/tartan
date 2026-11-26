"use client";
import { useSyncExternalStore } from "react";
import { w } from "@tartan/i18n/web";
import { Button } from "@/components/ui/button";
import { openBeta } from "./session";
const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
export function OpenBetaForm() {
  const token = useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => "",
  );
  if (!token) return <p>{w.admin.testers.unavailable}</p>;
  return (
    <form action={openBeta}>
      <p className="mb-3">{w.admin.testers.tracking}</p>
      <input type="hidden" name="token" value={token} />
      <Button type="submit">{w.admin.testers.readLink}</Button>
    </form>
  );
}
