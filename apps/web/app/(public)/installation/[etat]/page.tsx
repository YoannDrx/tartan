import { w } from "@tartan/i18n/web";
import { openTestFlight } from "../session";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { betaAccess } from "@/server/beta-testers.service";
const t = w.admin.testers;
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function BetaAccessPage({ params }: { params: Promise<{ etat: string }> }) {
  const ua = (await headers()).get("user-agent") ?? "";
  const { etat } = await params;
  const access = etat === "acces" ? await betaAccess((await cookies()).get("tartan_beta")?.value ?? "") : null;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-5">
      <h1 className="t-h1">{t.install}</h1>
      {!access ? (
        <p>{t.unavailable}</p>
      ) : (
        <>
          {access.ios && access.android && (/Android/i.test(ua) || /iPhone|iPod|iPad/i.test(ua)) && (
            <p>{t.suggested(/Android/i.test(ua) ? t.android : t.ios)}</p>
          )}
          {access.ios && (
            <section>
              <h2 className="t-h2">{t.ios}</h2>
              <p>{t.iosHelp}</p>
              <form action={openTestFlight}>
                <button type="submit" className="min-h-11 underline">
                  {t.testflight}
                </button>
              </form>
            </section>
          )}
          {access.android && (
            <section>
              <h2 className="t-h2">{t.android}</h2>
              <p>{t.androidHelp}</p>
              <a className="underline" href="/installation/apk" download>
                {t.apk(access.apk!.version)}
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
