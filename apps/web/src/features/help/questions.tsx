import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { HelpQuestion } from "./content";

// Des questions qui se déplient, sur une feuille encre : le centre d'aide et la page d'accueil montrent les mêmes.
export const HelpQuestions = ({ questions, className }: { questions: HelpQuestion[]; className?: string }) => (
  <div className={cn("on-card divide-y divide-card-line overflow-hidden rounded-card bg-card", className)}>
    {questions.map((question) => (
      <details key={question.id} className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold hover:bg-raise [&::-webkit-details-marker]:hidden">
          {question.q}
          <ChevronDown aria-hidden className="size-5 shrink-0 group-open:rotate-180 motion-safe:transition-transform" />
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
);
