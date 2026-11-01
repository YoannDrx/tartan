"use client";

import * as Sentry from "@sentry/nextjs";
import { m } from "@tartan/i18n";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="fr">
      <body style={{ background: "#C4442B", color: "#FFFFFF", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1>{m.common.genericError}</h1>
        <a href="/accueil" style={{ color: "#FFFFFF" }}>
          {m.common.retry}
        </a>
      </body>
    </html>
  );
}
