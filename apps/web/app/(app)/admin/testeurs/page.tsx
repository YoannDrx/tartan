import { w } from "@tartan/i18n/web";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
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
export default async function TestersPage() {
  const rows = await listBeta(await requireActor());
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title={t.title} />
      <AdminNav current={page} />
      {env().BETA_INVITES_ENABLED !== "true" && <p>{t.disabled}</p>}
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
