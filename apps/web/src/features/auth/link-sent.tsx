"use client";

import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { MailCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Entre deux envois : assez long pour laisser l'e-mail arriver, et bien en dessous des limites du serveur
// (cinq liens par minute et par adresse IP).
export const RESEND_COOLDOWN_SECONDS = 30;
// Après un refus du serveur, on attend la fenêtre entière.
const LIMITED_COOLDOWN_SECONDS = 60;

export type SentKind = "magic" | "verify";
// Ce que le renvoi a donné : parti, refusé par la limite de débit, ou autre échec.
export type ResendOutcome = "sent" | "limited" | "unreachable" | "failed";

// L'écran d'attente après l'envoi d'un lien : il rappelle l'adresse, permet de renvoyer le lien et de changer
// d'adresse, et dit quoi faire si rien n'arrive.
export const LinkSent = ({
  kind,
  email,
  notice,
  onResend,
  onChangeEmail,
}: {
  kind: SentKind;
  email: string;
  // Une précision sur la raison de l'attente (adresse pas encore confirmée, par exemple).
  notice?: string;
  onResend: () => Promise<ResendOutcome>;
  onChangeEmail: () => void;
}) => {
  const t = w.auth.sent;
  // Le renvoi s'ouvre à une heure donnée, relue chaque seconde : un onglet mis en veille ne fausse pas l'attente.
  const [clock, setClock] = useState(() => {
    const now = Date.now();
    return { now, until: now + RESEND_COOLDOWN_SECONDS * 1000 };
  });
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ResendOutcome | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const wait = Math.max(0, Math.ceil((clock.until - clock.now) / 1000));

  // L'écran remplace le formulaire : le titre reçoit le focus, le lecteur d'écran l'annonce.
  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    const tick = setInterval(() => setClock((current) => ({ ...current, now: Date.now() })), 1000);
    return () => clearInterval(tick);
  }, []);

  const resend = async () => {
    setPending(true);
    setOutcome(null);
    const result = await onResend();
    setPending(false);
    setOutcome(result);
    const now = Date.now();
    const seconds = result === "limited" ? LIMITED_COOLDOWN_SECONDS : RESEND_COOLDOWN_SECONDS;
    setClock({ now, until: now + seconds * 1000 });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MailCheck aria-hidden className="mt-1 size-6 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 ref={heading} tabIndex={-1} className="t-h2 outline-none">
            {kind === "magic" ? t.magicTitle : t.verifyTitle}
          </h2>
          {notice ? <p className="font-semibold">{notice}</p> : null}
          <p>{kind === "magic" ? t.magicLead : t.verifyLead}</p>
          <p className="font-semibold [overflow-wrap:anywhere]">{email}</p>
          <p>{kind === "magic" ? t.magicDetail : t.verifyDetail}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          className="px-4 py-2 leading-snug whitespace-normal"
          disabled={pending || wait > 0}
          onClick={() => void resend()}
        >
          {wait > 0 ? t.resendIn(wait) : t.resend}
        </Button>
        <Button variant="quiet" size="lg" onClick={onChangeEmail}>
          {t.changeEmail}
        </Button>
        <p role="status" className={outcome && outcome !== "sent" ? "text-alert" : "font-semibold"}>
          {outcome === "sent"
            ? t.resent
            : outcome === "limited"
              ? t.resendLimited
              : outcome === "unreachable"
                ? m.auth.emailUnreachable
                : outcome === "failed"
                  ? m.common.genericError
                  : ""}
        </p>
      </div>
      <section aria-labelledby="rien-recu" className="flex flex-col gap-1 border-t border-card-line pt-3">
        <h3 id="rien-recu" className="t-section">
          {t.helpTitle}
        </h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {t.help.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};
