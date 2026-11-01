import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { LaneArcs } from "@/components/pictos";
import { cn } from "@/lib/cn";

// Pages hors de l'app : le logotype blanc, le grand titre sur sa ligne de couloir, le contenu sur l'encre.
export const PublicPage = ({
  title,
  lead,
  children,
  width = "form",
}: {
  title?: string;
  lead?: ReactNode;
  children?: ReactNode;
  width?: "form" | "text" | "wide";
}) => (
  <main className="relative flex min-h-dvh flex-col overflow-x-clip pb-10">
    {width === "form" ? (
      <LaneArcs
        weight={3}
        className="pointer-events-none absolute bottom-0 right-0 hidden h-[70dvh] w-[46vw] text-lane desktop:block"
      />
    ) : null}
    <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-4 pt-5 desktop:px-6 desktop:pt-6">
      <Link
        href="/"
        aria-label="Tartan, retour au site"
        className="inline-flex min-h-11 items-center self-start no-underline"
      >
        <Wordmark />
      </Link>
      {title ? (
        <header className="mt-4 flex flex-col gap-4 desktop:mt-10">
          <div>
            <h1 className="t-display max-w-[18ch] text-balance">{title}</h1>
            {lead ? <div className="mt-2 max-w-[56ch] text-[16px] font-medium">{lead}</div> : null}
          </div>
          <div aria-hidden className="lane" />
        </header>
      ) : null}
      <div className={cn("mt-2 w-full", width === "form" ? "max-w-md" : width === "text" ? "max-w-3xl" : "")}>
        {children}
      </div>
    </div>
  </main>
);
