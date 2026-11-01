import type { ReactNode } from "react";
import { PublicPage } from "./public-page";

// Scène Lecture : le texte long se lit sur une grande carte encre, jamais sur le rouge.
export const LegalPage = ({ title, updated, children }: { title: string; updated: string; children: ReactNode }) => (
  <PublicPage
    title={title}
    lead={`Version de travail du ${updated}, à faire relire par un juriste avant publication.`}
    width="text"
  >
    <div className="on-card flex flex-col gap-4 rounded-card bg-card p-5 tablet:p-8 [&_a]:text-link [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:leading-[30px] [&_li]:ml-5 [&_li]:list-disc">
      {children}
    </div>
  </PublicPage>
);
