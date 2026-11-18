import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// Une ligne de réglage : ce que fait l'action, puis le bouton qui la nomme. Sur téléphone, le bouton passe dessous.
export const SettingRow = ({ children, action }: { children: ReactNode; action: ReactNode }) => (
  <li className="flex flex-col items-start gap-2 py-3 first:pt-1 last:pb-1 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-6">
    <p className="min-w-0 max-w-prose">{children}</p>
    <div className="shrink-0">{action}</div>
  </li>
);

// Une ligne qui mène ailleurs : toute la ligne se touche, le lien ne porte que son titre.
// `document` : la destination est une page du site (aide, contact), chargée en entier.
export const LinkRow = ({
  href,
  title,
  detail,
  document = false,
}: {
  href: string;
  title: string;
  detail: string;
  document?: boolean;
}) => {
  const className =
    "inline-flex min-h-7 items-center font-semibold text-inherit no-underline after:absolute after:inset-0 group-hover:underline";
  return (
    <li className="group relative flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1 leading-snug">
        <p>
          {document ? (
            <a href={href} className={className}>
              {title}
            </a>
          ) : (
            <Link href={href} className={className}>
              {title}
            </Link>
          )}
        </p>
        <p className="text-soft">{detail}</p>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-soft" />
    </li>
  );
};
