"use client";

import { m } from "@tartan/i18n";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/shell/sign-out";
import { authClient } from "@/lib/auth-client";

export const RevokeOtherSessionsButton = () => {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const revoke = async () => {
    setState("pending");
    const { error } = await authClient.revokeOtherSessions();
    setState(error ? "error" : "done");
  };
  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant="secondary" disabled={state === "pending"} onClick={() => void revoke()}>
        {m.settings.revokeOtherSessions}
      </Button>
      <p role="status" className="t-caption text-soft">
        {state === "done" ? m.settings.revokeOtherSessionsDone : state === "error" ? m.common.genericError : ""}
      </p>
    </div>
  );
};

export const SignOutButton = () => (
  <Button size="sm" variant="secondary" onClick={() => void signOut()}>
    {m.common.signOut}
  </Button>
);
