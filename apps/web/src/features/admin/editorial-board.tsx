import { m } from "@tartan/i18n";
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
  reviewLegacyCover,
  stamp,
  mediaKinds,
} from "@/server/catalog-editorial.service";
import { legacyCovers, legacyCoverStamp } from "@/server/legacy-catalog-covers";

const entries = [...EXERCISE_CATALOG, ...STADIUM_EDITION];
const entriesByKey = new Map(entries.map((entry) => [entry.catalogKey, entry]));
const illustrated = catalogImages.map((image) => entriesByKey.get(image.key)!);
const families = [...new Set(entries.map((entry) => entry.guide.family))].sort((a, b) =>
  m.exerciseGuide.families[a].localeCompare(m.exerciseGuide.families[b], "fr"),
);
const pageSize = 12;
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
async function reviewCover(form: FormData) {
  "use server";
  await reviewLegacyCover(
    await requireActor(),
    z.uuid().parse(form.get("id")),
    z.string().parse(form.get("stamp")),
    form.get("approved") === "true",
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
export async function EditorialBoard({
  selected,
  family,
  page,
}: {
  selected?: string;
  family?: string;
  page?: string;
}) {
  const actor = await requireActor();
  const [approved, outside] = await Promise.all([approvedEditorial(), unversionedCommonExercises(actor)]);
  const linkable = entries.filter((e) =>
    mediaKinds.every((kind) => approved.has(stamp(e.catalogKey, e.catalogVersion, kind))),
  );
  const chosenFamily = families.find((value) => value === family);
  const matching = chosenFamily ? illustrated.filter((entry) => entry.guide.family === chosenFamily) : illustrated;
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const requestedPage = Number(page);
  const currentPage = Number.isSafeInteger(requestedPage) ? Math.min(pageCount, Math.max(1, requestedPage)) : 1;
  const rows = selected
    ? entries.filter((entry) => entry.catalogKey === selected)
    : matching.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageLink = (number: number) => ({
    pathname: "/admin/exercices",
    query: { ...(chosenFamily ? { famille: chosenFamily } : {}), page: String(number) },
    hash: "atelier",
  });
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
            {outside.map((entry) => {
              const cover = legacyCovers.get(entry.id);
              const coverStamp = cover && legacyCoverStamp(cover);
              const isApproved = !!coverStamp && approved.has(coverStamp);
              return (
                <li key={entry.id} className="border-t border-card-line py-2">
                  {entry.name}
                  {cover && coverStamp && (
                    <details>
                      <summary className="min-h-11 cursor-pointer">{t.reviewCover}</summary>
                      <img
                        loading="lazy"
                        src={cover.path}
                        alt={cover.alt}
                        width={488}
                        height={488}
                        className="h-auto w-full max-w-[488px]"
                      />
                      <form action={reviewCover}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="stamp" value={coverStamp} />
                        <input type="hidden" name="approved" value={String(!isApproved)} />
                        <Button type="submit" variant="secondary">
                          {t.image} · {isApproved ? t.reopen : t.approve}
                        </Button>
                      </form>
                    </details>
                  )}
                  {entry.catalogKey === null && (linkable.length > 0 || entry.sourceCatalogKey) && (
                    <form action={linkGuide} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="updatedAt" value={entry.updatedAt.toISOString()} />
                      <label className="grid min-w-0 gap-1">
                        {t.legacyGuide}
                        <select
                          className="min-h-11 max-w-full"
                          name="target"
                          defaultValue={entry.sourceCatalogKey ?? ""}
                        >
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
              );
            })}
          </ul>
        </details>
      )}
      {selected ? (
        <Link href={pageLink(currentPage)} prefetch={false} className="inline-flex min-h-11 items-center underline">
          {t.back}
        </Link>
      ) : (
        <form action="/admin/exercices#atelier" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            {t.family}
            <select
              name="famille"
              defaultValue={chosenFamily ?? ""}
              className="min-h-11 rounded-control border border-card-line px-2"
            >
              <option value="">{t.allFamilies}</option>
              {families.map((value) => (
                <option key={value} value={value}>
                  {m.exerciseGuide.families[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary">
            {t.show}
          </Button>
        </form>
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
      {!selected && pageCount > 1 && (
        <nav aria-label={t.pages} className="flex flex-wrap items-center gap-3">
          {currentPage > 1 && (
            <Link
              prefetch={false}
              className="inline-flex min-h-11 items-center underline"
              href={pageLink(currentPage - 1)}
            >
              {t.previous}
            </Link>
          )}
          <span>{t.pageOf(currentPage, pageCount)}</span>
          {currentPage < pageCount && (
            <Link
              prefetch={false}
              className="inline-flex min-h-11 items-center underline"
              href={pageLink(currentPage + 1)}
            >
              {t.next}
            </Link>
          )}
        </nav>
      )}
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
