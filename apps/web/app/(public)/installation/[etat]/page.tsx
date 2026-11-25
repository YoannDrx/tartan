import { w } from "@tartan/i18n/web";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { betaAccess } from "@/server/beta-testers.service";
const t = w.admin.testers;
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function BetaAccessPage({ params }: { params: Promise<{ etat: string }> }) {
  const { etat } = await params;
  const access = etat === "acces" ? await betaAccess((await cookies()).get("tartan_beta")?.value ?? "") : null;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-5">
      <h1 className="t-h1">{t.install}</h1>
      {!access ? (
        <p>{t.unavailable}</p>
      ) : (
        <>
          {access.ios && (
            <section>
              <h2 className="t-h2">{t.ios}</h2>
              <p>{t.iosHelp}</p>
              <a className="underline" href="https://apps.apple.com/fr/app/testflight/id899247664">
                {t.testflight}
              </a>
            </section>
          )}
          {access.android && (
            <section>
              <h2 className="t-h2">{t.android}</h2>
              <p>{t.androidHelp}</p>
              <a className="underline" href="/installation/apk" download>
                {t.apk(env().BETA_APK_VERSION!)}
              </a>
            </section>
          )}
          {access.play && (
            <a className="underline" href={env().BETA_PLAY_URL}>
              {t.play}
            </a>
          )}
          {!access.ios && !access.android && !access.play && <p>{t.pending}</p>}
        </>
      )}
    </main>
  );
}
