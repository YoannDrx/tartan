import Link from "next/link";
import { m } from "@tartan/i18n";
import { Wordmark } from "@/components/logo";

// Sur app.tartan.coach, « / » mène à l'application : le retour au site passe par son adresse.
export const SITE_HOME = process.env.VERCEL_ENV === "production" ? "https://tartan.coach/" : "/";

// Ce que partagent le site et ses pages : on peut toujours rejoindre les tarifs, la connexion et les textes légaux.
export const SiteHeader = () => (
  <header className="flex items-center justify-between">
    <a href={SITE_HOME} aria-label="Tartan, retour au site" className="inline-flex min-h-11 items-center no-underline">
      <Wordmark />
    </a>
    <div className="flex items-center gap-4">
      <a href={`${SITE_HOME}#tarifs`} className="inline-flex min-h-11 items-center font-semibold">
        {m.billing.pricing}
      </a>
      {/* La connexion vit sur app.tartan.coach : une vraie navigation, car la CSP bloque le préchargement vers ce domaine. */}
      <a
        href="/connexion"
        className="inline-flex min-h-11 items-center rounded-full border-2 border-on-page px-5 font-semibold no-underline hover:bg-raise"
      >
        {m.landing.signIn}
      </a>
    </div>
  </header>
);

export const SiteFooter = () => (
  <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 py-8">
    <Link href="/tarifs" className="min-h-11 content-center">
      {m.billing.pricing}
    </Link>
    <Link href="/confidentialite" className="min-h-11 content-center">
      {m.legal.privacy}
    </Link>
    <Link href="/conditions" className="min-h-11 content-center">
      {m.legal.terms}
    </Link>
    <Link href="/cgv" className="min-h-11 content-center">
      {m.landing.footer.sales}
    </Link>
    <Link href="/mentions-legales" className="min-h-11 content-center">
      {m.landing.footer.notice}
    </Link>
    <Link href="/contact" className="min-h-11 content-center">
      {m.legal.contact}
    </Link>
  </footer>
);
