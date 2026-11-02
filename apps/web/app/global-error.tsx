"use client";

import * as Sentry from "@sentry/nextjs";
import { m } from "@tartan/i18n";
import { useEffect } from "react";
import { fontVariables } from "./fonts";
import "./globals.css";

// Le dernier recours remplace toute la mise en page : il garde quand même la piste, ses polices et son bouton.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="fr" className={fontVariables}>
      <body>
        <main className="mx-auto flex min-h-dvh max-w-[1200px] flex-col items-start gap-4 overflow-x-clip px-4 pt-16 desktop:px-6">
          <h1 className="t-display max-w-[18ch] text-balance">{m.common.genericError}</h1>
          <div aria-hidden className="lane w-full" />
          <a
            href="/accueil"
            className="mt-2 inline-flex min-h-12 items-center rounded-full bg-cta px-5 font-semibold text-on-cta no-underline hover:bg-cta-hover"
          >
            {m.common.retry}
          </a>
        </main>
      </body>
    </html>
  );
}
