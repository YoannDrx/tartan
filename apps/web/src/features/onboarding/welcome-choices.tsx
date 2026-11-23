import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { w } from "@tartan/i18n/web";
import { LaneNumber } from "@/components/lane-number";
import { InvitationCode } from "./invitation-code";

const t = w.welcome;

const Head = ({ lane, title, detail }: { lane: number; title: string; detail: string }) => (
  <>
    <LaneNumber n={lane} className="text-[40px]" />
    <span className="flex min-w-0 flex-col gap-1">
      <span className="t-h2">{title}</span>
      <span className="text-soft">{detail}</span>
    </span>
  </>
);

const Choice = ({ lane, title, detail, href }: { lane: number; title: string; detail: string; href: string }) => (
  <li>
    <Link
      href={href}
      className="grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-inherit no-underline hover:bg-raise"
    >
      <Head lane={lane} title={title} detail={detail} />
      <ChevronRight aria-hidden className="size-6 shrink-0" />
    </Link>
  </li>
);

// Un choix que le réglage de la console ferme : il reste visible, avec ce qu'il faut faire à la place.
const Closed = ({
  lane,
  title,
  detail,
  children,
}: {
  lane: number;
  title: string;
  detail: string;
  children: ReactNode;
}) => (
  <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 px-5 py-4">
    <Head lane={lane} title={title} detail={detail} />
    <div className="col-start-2 flex flex-col gap-1">{children}</div>
  </li>
);

// Trois chemins de même rang, en une liste : coach, athlète qui s'entraîne seul, invitation reçue.
export const WelcomeChoices = ({
  coachOpen,
  athleteOpen,
  contact,
}: {
  coachOpen: boolean;
  athleteOpen: boolean;
  contact: string;
}) => (
  <ol aria-label={t.choicesLabel} className="on-card divide-y divide-card-line overflow-hidden rounded-card bg-card">
    {coachOpen ? (
      <Choice lane={1} title={t.coach.title} detail={t.coach.detail} href="/bienvenue/coach" />
    ) : (
      <Closed lane={1} title={t.coach.title} detail={t.coach.detail}>
        <p>{t.coachClosed}</p>
        <a href={`mailto:${contact}`} className="flex min-h-11 items-center font-semibold">
          {contact}
        </a>
      </Closed>
    )}
    {athleteOpen ? (
      <Choice lane={2} title={t.solo.title} detail={t.solo.detail} href="/bienvenue/seul" />
    ) : (
      <Closed lane={2} title={t.solo.title} detail={t.solo.detail}>
        <p>{t.athleteClosed}</p>
      </Closed>
    )}
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 px-5 py-4">
      <Head lane={3} title={t.invite.title} detail={t.invite.detail} />
      <div className="col-span-2 tablet:col-span-1 tablet:col-start-2">
        <InvitationCode />
      </div>
    </li>
  </ol>
);
