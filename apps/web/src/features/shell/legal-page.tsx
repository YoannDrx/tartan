import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export const LegalPage = ({ title, updated, children }: { title: string; updated: string; children: ReactNode }) => (
  <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
    <Link href="/" aria-label="Tartan, retour au site" className="self-start">
      <Logo height={32} />
    </Link>
    <div>
      <h1 className="t-display">{title}</h1>
      <p className="text-muted">Version de travail du {updated}, à faire relire par un juriste avant publication.</p>
    </div>
    <div className="flex flex-col gap-4 [&_h2]:t-h2 [&_h2]:mt-4 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
  </main>
);
