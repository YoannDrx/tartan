import { ChevronDown, Mail } from "lucide-react";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { LaneNumber } from "@/components/lane-number";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/features/shell/public-page";
import { helpThemes } from "./content";

const t = m.help;

// Les thèmes sont les couloirs : numéros au départ, lignes blanches entre eux, réponses sur l'encre.
export const HelpCenter = ({ embedded = false }: { embedded?: boolean }) => {
  const themes = helpThemes(embedded);
  return (
    <PublicPage title={t.title} lead={t.lead} site embedded={embedded} width="wide">
      <div className="flex flex-col gap-10 desktop:grid desktop:grid-cols-[300px_minmax(0,1fr)] desktop:items-start desktop:gap-16">
        <nav aria-label={t.themesLabel} className="desktop:sticky desktop:top-6">
          <ol className="border-t-2 border-lane tablet:grid tablet:grid-cols-2 tablet:gap-x-8 tablet:border-t-0 desktop:block desktop:border-t-2">
            {themes.map((theme, index) => (
              <li key={theme.id} className="border-b-2 border-lane tablet:max-desktop:[&:nth-child(-n+2)]:border-t-2">
                <a
                  href={`#${theme.id}`}
                  className="flex min-h-14 items-center gap-4 text-[17px] font-semibold no-underline hover:bg-raise"
                >
                  <LaneNumber n={index + 1} className="text-[34px]" />
                  {theme.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 max-w-[720px] flex-col gap-10">
          {themes.map((theme, index) => (
            <section key={theme.id} id={theme.id} aria-labelledby={`${theme.id}-titre`} className="scroll-mt-6">
              <h2 id={`${theme.id}-titre`} className="t-h2 flex items-baseline gap-3">
                <LaneNumber n={index + 1} className="text-[34px]" />
                {theme.title}
              </h2>
              <div className="on-card mt-3 divide-y divide-card-line overflow-hidden rounded-card bg-card">
                {theme.questions.map((question) => (
                  <details key={question.id} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold hover:bg-raise [&::-webkit-details-marker]:hidden">
                      {question.q}
                      <ChevronDown
                        aria-hidden
                        className="size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform"
                      />
                    </summary>
                    <div className="max-w-[62ch] px-4 pb-4">
                      <p>{question.a}</p>
                      {question.link ? (
                        <Link
                          href={question.link.href}
                          className="mt-1 inline-flex min-h-11 items-center font-semibold text-ctx-link underline underline-offset-4"
                        >
                          {question.link.label}
                        </Link>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <section aria-labelledby="aide-contact" className="border-t-2 border-lane pt-6">
            <h2 id="aide-contact" className="t-h2">
              {t.notFoundTitle}
            </h2>
            <p className="mt-1 max-w-[56ch] font-medium">{t.notFoundBody}</p>
            <Button asChild size="lg" className="mt-4 w-full tablet:w-auto">
              <Link href={embedded ? "/mobile/contact" : "/contact"}>
                <Mail aria-hidden className="size-5" />
                {t.write}
              </Link>
            </Button>
          </section>
        </div>
      </div>
    </PublicPage>
  );
};
