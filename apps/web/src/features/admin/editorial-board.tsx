import { w } from "@tartan/i18n/web";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { gestureClip } from "@tartan/mascot/v2/registry";
import Link from "next/link";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { GuideMotion } from "@/features/exercises/guide-motion";
import { requireActor } from "@/lib/session";
import { catalogImages, imagePath } from "@/server/catalog-illustrations";
import {
  unversionedCommonExercises,
  approvedEditorial,
  reviewEditorial,
  linkLegacyGuide,
  stamp,
  mediaKinds,
} from "@/server/catalog-editorial.service";
const entries = [...EXERCISE_CATALOG, ...STADIUM_EDITION];
const t = w.admin.editorial;
async function review(form: FormData) {
  "use server";
  await reviewEditorial(
    await requireActor(),
    z.string().parse(form.get("key")),
    z.coerce.number().int().positive().parse(form.get("version")),
    z.enum(mediaKinds).parse(form.get("kind")),
    form.get("approved") === "true",
    z.string().parse(form.get("stamp")),
  );
  revalidatePath("/admin/exercices");
}
async function linkGuide(form: FormData) {
  "use server";
  await linkLegacyGuide(
    await requireActor(),
    z.uuid().parse(form.get("id")),
    z.coerce.date().parse(form.get("updatedAt")),
    z.string().max(100).parse(form.get("target")) || null,
  );
  revalidatePath("/admin/exercices");
}
export async function EditorialBoard({ selected }: { selected?: string }) {
  const actor = await requireActor();
  const [approved, outside] = await Promise.all([approvedEditorial(), unversionedCommonExercises(actor)]);
  const linkable = entries.filter((e) =>
    mediaKinds.every((kind) => approved.has(stamp(e.catalogKey, e.catalogVersion, kind))),
  );
  const rows = selected
    ? entries.filter((e) => e.catalogKey === selected)
    : catalogImages.map((p) => entries.find((e) => e.catalogKey === p.key)!);
  return (
    <section id="atelier" className="rounded-card bg-card p-4 on-card">
      <h2 className="t-h2">{t.title}</h2>
      <p>{t.publication}</p>
      <p>
        {t.coverage(
          catalogImages.filter((p) => approved.has(stamp(p.key, p.guideVersion, "image"))).length,
          entries.length,
        )}
      </p>
      {outside.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer">{t.unversioned(outside.length)}</summary>
          <p>{t.legacyHelp}</p>
          {!linkable.length && <p>{t.needsReview}</p>}
          <ul>
            {outside.map((entry) => (
              <li key={entry.id} className="border-t border-card-line py-2">
                {entry.name}
                {entry.catalogKey === null && (linkable.length > 0 || entry.sourceCatalogKey) && (
                  <form action={linkGuide} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="updatedAt" value={entry.updatedAt.toISOString()} />
                    <label className="grid min-w-0 gap-1">
                      {t.legacyGuide}
                      <select className="min-h-11 max-w-full" name="target" defaultValue={entry.sourceCatalogKey ?? ""}>
                        <option value="">{t.noLegacyGuide}</option>
                        {entries
                          .filter((e) => e.catalogKey === entry.sourceCatalogKey || linkable.includes(e))
                          .map((e) => (
                            <option key={e.catalogKey} value={e.catalogKey}>
                              {e.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button type="submit" variant="secondary">
                      {t.linkGuide}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {rows.map((entry) => {
        const key = entry.catalogKey,
          version = entry.catalogVersion,
          p = catalogImages.find((p) => p.key === key);
        return (
          <details open={selected === key} className="border-t border-card-line py-2" key={key}>
            <summary className="flex min-h-12 cursor-pointer items-center gap-3">
              {p && <img loading="lazy" width={64} height={64} src={imagePath(p, true)} alt="" />}
              {entry.name}
            </summary>
            <div className="grid gap-3 tablet:grid-cols-2">
              <div>
                <p>{entry.guide.objective}</p>
                <p>{entry.guide.setup.join(" ")}</p>
                <ol className="list-decimal pl-5">
                  {entry.guide.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p>{entry.guide.counting.explanation}</p>
                {gestureClip(key) ? (
                  <GuideMotion guide={entry.guide} autoPlay={false} />
                ) : (
                  <p>
                    {t.motion} · {t.missing}
                  </p>
                )}
              </div>
              {p ? (
                <img loading="lazy" src={imagePath(p)} width={488} height={488} className="h-auto w-full" alt={p.alt} />
              ) : (
                <p>
                  {t.image} · {t.missing}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {mediaKinds.map((kind) => {
                const id = stamp(key, version, kind);
                const ok = approved.has(id);
                return (
                  <form key={kind} action={review}>
                    <input type="hidden" name="key" value={key} />
                    <input type="hidden" name="version" value={version} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="stamp" value={id} />
                    <input type="hidden" name="approved" value={String(!ok)} />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={(kind === "motion" && !gestureClip(key)) || (kind === "image" && !p)}
                    >
                      {t[kind]} · {ok ? t.reopen : t.approve}
                    </Button>
                  </form>
                );
              })}
            </div>
          </details>
        );
      })}
      <details>
        <summary className="min-h-11 cursor-pointer">{t.backlog}</summary>
        <ul>
          {entries
            .filter((e) => !catalogImages.some((p) => p.key === e.catalogKey))
            .map((e) => (
              <li key={e.catalogKey}>
                <Link
                  prefetch={false}
                  className="inline-flex min-h-11 items-center underline"
                  href={{ pathname: "/admin/exercices", query: { fiche: e.catalogKey }, hash: "atelier" }}
                >
                  {e.name}
                </Link>
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}
