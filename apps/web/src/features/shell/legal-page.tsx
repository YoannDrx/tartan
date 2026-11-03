import type { ReactNode } from "react";
import { PublicPage } from "./public-page";

// Le texte long se lit sur la craie : encre sur fond clair, sans carte.
export const LegalPage = ({ title, updated, children }: { title: string; updated: string; children: ReactNode }) => (
  <PublicPage
    title={title}
    lead={`Version de travail du ${updated}, à faire relire par un juriste avant publication.`}
    width="text"
    site
    world="craie"
  >
    <div className="flex flex-col gap-4 tablet:max-w-[58ch] [&_p]:max-w-[58ch] [&_ul]:max-w-[58ch] [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:leading-[30px] [&_li]:ml-5 [&_li]:list-disc">
      {children}
    </div>
  </PublicPage>
);
