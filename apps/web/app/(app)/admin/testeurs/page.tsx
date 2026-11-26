import { w } from "@tartan/i18n/web";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { BetaLink } from "@/features/admin/beta-link";
import { currentApk, publishApk, stagedApk } from "@/server/beta-apk.service";
import { AdminNav } from "@/features/admin/console-ui";
import { requireActor } from "@/lib/session";
import { changeBeta, inviteBeta, listBeta } from "@/server/beta-testers.service";
import { env } from "@/lib/env";
const t = w.admin.testers;
const page = "/admin/testeurs";
async function invite(form: FormData) {
  "use server";
  await inviteBeta(
    await requireActor(),
    z.string().parse(form.get("email")),
    z.enum(["ios", "android", "both"]).parse(form.get("platform")),
  );
  revalidatePath(page);
}
async function change(form: FormData) {
  "use server";
  await changeBeta(
    await requireActor(),
    z.uuid().parse(form.get("id")),
    z.coerce.number().int().positive().parse(form.get("version")),
    z.enum(["resend", "revoke", "play", "removed"]).parse(form.get("action")),
  );
  revalidatePath(page);
}
async function publish(form: FormData) {
  "use server";
  await publishApk(
    await requireActor(),
    z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(form.get("digest")),
  );
  revalidatePath(page);
}
export default async function TestersPage() {
  const actor = await requireActor();
  const rows = await listBeta(actor);
  const [current, staged] = await Promise.all([
    currentApk(),
    stagedApk(actor)
      .then((candidate) => ({ candidate, failed: false }))
      .catch(() => ({ candidate: null, failed: true })),
  ]);
  const { candidate } = staged;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title={t.title} />
      <AdminNav current={page} />
      {env().BETA_INVITES_ENABLED !== "true" && <p>{t.disabled}</p>}
      {staged.failed && <p role="status">{t.badApk}</p>}
      {current && (
        <p>
          {t.latest} · {current.version} {current.build || ""}
        </p>
      )}
      {candidate && candidate.build > (current?.build ?? 0) && (
        <form action={publish}>
          <p>
            {t.candidate} · {candidate.version} ({candidate.build})
          </p>
          <input type="hidden" name="digest" value={candidate.digest} />
          <Button type="submit">{t.publish}</Button>
        </form>
      )}
      <form action={invite} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          {t.email}
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            maxLength={254}
            className="min-h-12 rounded-button border border-card-line p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          {t.platform}
          <select name="platform" className="min-h-12 rounded-button border border-card-line p-2">
            <option value="both">{t.both}</option>
            <option value="ios">{t.ios}</option>
            <option value="android">{t.android}</option>
          </select>
        </label>
        <Button type="submit">{t.invite}</Button>
      </form>
      {rows.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul className="divide-y divide-card-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-4">
              <h2 className="break-all font-semibold">{r.email}</h2>
              {r.ios && (
                <p>
                  {t.ios} · {r.ios}
                </p>
              )}
              {r.android && (
                <p>
                  {t.android} · {r.android}
                </p>
              )}
              {r.url && <BetaLink url={r.url} />}
              {(
                [
                  [t.opened, r.openedAt],
                  [t.downloaded, r.apkAt],
                  [t.appleOpened, r.appleAt],
                ] as const
              ).map(
                ([label, date]) =>
                  date && (
                    <p key={label}>
                      {label} · {date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                    </p>
                  ),
              )}
              {r.installations.map((device) => (
                <p key={device.installationId}>
                  {device.model ?? device.platform} · {device.platform} {device.os} · {device.appVersion} (
                  {device.build})<br />
                  {t.firstSeen} · {device.firstSeenAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                  <br />
                  {t.lastSeen} · {device.lastSeenAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                </p>
              ))}
              <form action={change} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="version" value={r.version} />
                {r.active && (
                  <>
                    <Button type="submit" variant="secondary" name="action" value="resend">
                      {t.retry}
                    </Button>
                    {r.android && r.playConfig && !r.playAuthorized && (
                      <Button type="submit" variant="secondary" name="action" value="play">
                        {t.playConfirm}
                      </Button>
                    )}
                    <details>
                      <summary className="cursor-pointer p-2">{t.revoke}</summary>
                      <p>{t.removeConfirm}</p>
                      <Button type="submit" variant="secondary" name="action" value="revoke">
                        {t.revoke}
                      </Button>
                    </details>
                  </>
                )}
                {!r.active && r.playAuthorized && (
                  <>
                    <p>{t.playPendingRemoval}</p>
                    <Button type="submit" name="action" value="removed">
                      {t.playRemoved}
                    </Button>
                  </>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
