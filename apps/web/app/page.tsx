import type { Metadata } from "next";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { Wordmark } from "@/components/logo";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { absolute: m.brand.storeName },
  description: "Le carnet d'entraînement partagé du coach d'athlé et de son groupe.",
};

const lanes = [
  {
    title: "Tu crées la séance une fois.",
    body: "Pour le groupe, un sous-groupe ou un athlète. Chacun la reçoit en notification, avec ses propres charges.",
  },
  {
    title: "L’absent reçoit la bonne version.",
    body: "Au club ou en autonomie : après l'appel, la bascule se fait toute seule.",
  },
  {
    title: "Tu vois qui a fait quoi.",
    body: "L'athlète valide en moins de 10 secondes. Fait, partiel, manqué : une ligne par athlète, une case par séance.",
  },
  {
    title: "Chaque saut devient une leçon.",
    body: "Filmé, rattaché à la barre et à l'essai, revu image par image, commenté à l'instant précis de l'impulsion.",
  },
];

export default function LandingPage() {
  const signupOpen = env().COACH_SIGNUP_MODE === "public";
  return (
    <main className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 pt-6 desktop:px-6">
        <Wordmark />
        <div className="flex items-center gap-4">
          <Link href="/tarifs" className="inline-flex min-h-11 items-center font-semibold">
            {m.billing.pricing}
          </Link>
          <Link
            href="/connexion"
            className="inline-flex min-h-11 items-center rounded-full border-2 border-on-page px-5 font-semibold no-underline hover:bg-brand-strong"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-12 desktop:px-6 desktop:pt-20">
        <h1 className="max-w-[16ch] font-display text-[60px] font-bold leading-[0.95] desktop:text-[120px]">
          Le carnet d’entraînement de ton groupe.
        </h1>
        <p className="mt-6 max-w-[44ch] text-[18px] leading-[26px] desktop:text-[20px] desktop:leading-[28px]">
          Pour les coachs de saut en hauteur et leur groupe. Plus de séances perdues dans les SMS : chacun sait ce qu'il
          a à faire, et tu sais ce qui a été fait.
        </p>
        <Link
          href={signupOpen ? "/connexion" : "/contact"}
          className="mt-8 inline-flex min-h-[52px] items-center rounded-full bg-cta px-7 text-base font-semibold text-on-cta no-underline hover:bg-cta-hover"
        >
          {signupOpen ? "Créer mon espace coach" : "Rejoindre le pilote"}
        </Link>
      </section>

      {/* La piste : quatre couloirs numérotés, coupés par la ligne d'arrivée, comme le logo. */}
      <section aria-label="Comment ça marche" className="relative border-b-[3px] border-white">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-[11%] hidden w-[7px] bg-white desktop:block"
        />
        <ol>
          {lanes.map((lane, i) => (
            <li key={lane.title} className="border-t-[3px] border-white">
              <div className="mx-auto grid max-w-[1200px] grid-cols-[48px_1fr] gap-x-4 px-4 py-8 desktop:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_12%] desktop:gap-x-8 desktop:px-6 desktop:py-10">
                <span aria-hidden className="t-num text-[48px] font-bold leading-none desktop:text-[72px]">
                  {i + 1}
                </span>
                <h2 className="font-display text-[28px] font-bold leading-[32px] desktop:text-[36px] desktop:leading-[40px]">
                  {lane.title}
                </h2>
                <p className="col-start-2 mt-2 max-w-[48ch] desktop:col-start-3 desktop:mt-0">{lane.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 desktop:px-6">
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
          Conditions de vente
        </Link>
        <Link href="/mentions-legales" className="min-h-11 content-center">
          Mentions légales
        </Link>
        <Link href="/contact" className="min-h-11 content-center">
          {m.legal.contact}
        </Link>
      </footer>
    </main>
  );
}
