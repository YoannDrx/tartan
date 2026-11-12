import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { SITE_HOME, SiteFooter, SiteHeader } from "@/features/shell/site-chrome";
import { LaneArcs } from "@/components/pictos";
import { Marked } from "@/components/marked";
import { cn } from "@/lib/cn";

// Pages hors de l'app : le logotype blanc, le grand titre sur sa ligne de couloir, le contenu sur l'encre.
export const PublicPage = ({
  title,
  lead,
  children,
  width = "form",
  site = false,
  world = "piste",
  embedded = false,
  scene,
  scenePhone = true,
}: {
  title?: string;
  lead?: ReactNode;
  children?: ReactNode;
  width?: "form" | "text" | "wide";
  // Page du site (tarifs, contact, textes légaux) : navigation et pied de page. Les parcours ciblés restent sans issue parasite.
  site?: boolean;
  world?: "piste" | "couloir" | "craie" | "soleil" | "nuit";
  // Ouverte depuis l'app : ni navigation, ni pied de page, ni logo. Rien ne doit mener aux tarifs.
  embedded?: boolean;
  // Des athlètes du groupe sur la piste : à droite du formulaire sur ordinateur, sous lui sur téléphone.
  scene?: ReactNode;
  // Un formulaire long garde tout l'écran du téléphone : la scène n'y apparaît que sur ordinateur.
  scenePhone?: boolean;
}) => (
  <main className={cn(`world-${world}`, "relative flex min-h-dvh flex-col overflow-x-clip pb-10")}>
    {width === "form" && !site && !scene ? (
      <LaneArcs
        weight={3}
        className="pointer-events-none absolute bottom-0 right-0 hidden h-[70dvh] w-[46vw] text-lane desktop:block"
      />
    ) : null}
    {scene ? (
      <div className="pointer-events-none absolute bottom-[14dvh] right-0 hidden w-[44vw] desktop:flex">{scene}</div>
    ) : null}
    <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-4 pt-5 desktop:px-6 desktop:pt-6">
      {embedded ? null : site ? (
        <SiteHeader />
      ) : (
        <a
          href={SITE_HOME}
          aria-label="Tartan, retour au site"
          className="inline-flex min-h-11 items-center self-start no-underline"
        >
          <Wordmark />
        </a>
      )}
      {title ? (
        <header className="mt-4 flex flex-col gap-4 desktop:mt-10">
          <div>
            <h1 className="t-display max-w-[18ch] text-balance">
              <Marked text={title} />
            </h1>
            {lead ? <div className="mt-2 max-w-[56ch] text-[16px] font-medium">{lead}</div> : null}
          </div>
          <div aria-hidden className="lane" />
        </header>
      ) : null}
      <div className={cn("mt-2 w-full", width === "form" ? "max-w-md" : width === "text" ? "max-w-3xl" : "")}>
        {children}
      </div>
      {scene && scenePhone ? <div className="mt-6 w-full max-w-md desktop:hidden">{scene}</div> : null}
      {site && !embedded ? (
        <div className="mt-auto pt-8">
          <SiteFooter />
        </div>
      ) : null}
    </div>
  </main>
);
