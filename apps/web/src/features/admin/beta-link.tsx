"use client";
import { useState } from "react";
import { w } from "@tartan/i18n/web";
import { Button } from "@/components/ui/button";
export function BetaLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  return (
    <div>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setFallback(true);
          }
        }}
      >
        {copied ? w.admin.testers.copied : w.admin.testers.copy}
      </Button>
      {fallback && (
        <input aria-label={w.admin.testers.copy} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}
