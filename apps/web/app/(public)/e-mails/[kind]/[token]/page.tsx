import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/features/shell/public-page";
import { isValidUnsubscribe } from "@/server/email-preferences.service";

export const metadata: Metadata = { title: m.email.unsubscribeTitle, robots: { index: false } };

// Afficher cette page ne change rien : seul le bouton coupe l'envoi.
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; token: string }>;
  searchParams: Promise<{ fait?: string }>;
}) {
  const { kind, token } = await params;
  const { fait } = await searchParams;
  if (!isValidUnsubscribe(kind, token)) notFound();
  return (
    <PublicPage title={m.email.unsubscribeTitle}>
      <div className="on-card flex flex-col gap-4 rounded-card bg-card p-5">
        {fait ? (
          <p role="status">{m.email.unsubscribeDone}</p>
        ) : (
          <>
            <p>{m.email.unsubscribeKinds[kind]}</p>
            <form method="post" action={`/api/email/desinscription/${kind}/${token}`}>
              <Button type="submit" size="lg">
                {m.email.unsubscribeConfirm}
              </Button>
            </form>
          </>
        )}
      </div>
    </PublicPage>
  );
}
