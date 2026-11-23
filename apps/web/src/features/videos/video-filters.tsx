import Link from "next/link";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import type { VideoQuery } from "@/server/video.service";
import { VideoFilterSheet } from "./video-filter-sheet";

export type VideoSearch = {
  athlete?: string;
  groupe?: string;
  exercice?: string;
  session?: string;
  status?: string;
  review?: string;
  cursor?: string;
};
const uuid = (value?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "") ? value : undefined;
export const videoQuery = (search: VideoSearch): VideoQuery => ({
  athleteId: uuid(search.athlete),
  groupId: uuid(search.groupe),
  exerciseId: uuid(search.exercice),
  sessionId: uuid(search.session),
  cursor: uuid(search.cursor),
  status:
    search.status === "ready" ||
    search.status === "uploading" ||
    search.status === "processing" ||
    search.status === "error"
      ? search.status
      : undefined,
  needsReview: search.review === "pending",
});

const FILTER_KEYS = ["athlete", "groupe", "exercice", "session", "status", "review"] as const;

// Le nombre de filtres posés, affiché sur le bouton de la feuille.
export const activeVideoFilters = (search: VideoSearch) => FILTER_KEYS.filter((key) => Boolean(search[key])).length;

type FilterProps = {
  search: VideoSearch;
  athletes?: { id: string; name: string }[];
  groups?: { id: string; name: string }[];
  sessions?: { id: string; label: string }[];
  exercises?: { id: string; name: string }[];
  staff?: boolean;
};

// Sur ordinateur, les filtres tiennent sur une ligne au-dessus de la liste ; plus étroit, ils passent dans une feuille.
export function VideoFilters({ basePath, ...props }: FilterProps & { basePath: string }) {
  return (
    <>
      <VideoFilterSheet active={activeVideoFilters(props.search)} clearHref={basePath}>
        <FilterForm {...props} sheet />
      </VideoFilterSheet>
      <div className="max-desktop:hidden">
        <FilterForm {...props} />
      </div>
    </>
  );
}

function FilterForm({
  search,
  athletes = [],
  groups = [],
  sessions = [],
  exercises = [],
  staff = false,
  sheet = false,
}: FilterProps & { sheet?: boolean }) {
  // Dans la feuille, une colonne pleine largeur ; sur ordinateur, des champs de largeur fixe sur une ligne.
  const field = sheet ? "min-w-0 w-full" : "min-w-0 w-48";
  return (
    <form
      method="get"
      aria-label={m.videoCollaboration.filter}
      className={sheet ? "flex flex-col gap-3" : "flex flex-wrap items-end gap-3"}
    >
      {athletes.length ? (
        <Field className={field} label={m.videoCollaboration.athlete}>
          {(a) => (
            <Select {...a} name="athlete" defaultValue={search.athlete ?? ""}>
              <option value="">{m.videoCollaboration.allAthletes}</option>
              {athletes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {groups.length > 1 ? (
        <Field className={field} label={m.videoCollaboration.group}>
          {(a) => (
            <Select {...a} name="groupe" defaultValue={search.groupe ?? ""}>
              <option value="">{m.videoCollaboration.allGroups}</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {sessions.length ? (
        <Field className={field} label={m.video.linkedSession}>
          {(a) => (
            <Select {...a} name="session" defaultValue={search.session ?? ""}>
              <option value="">{m.videoCollaboration.allSessions}</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {exercises.length ? (
        <Field className={field} label={m.video.exerciseLink}>
          {(a) => (
            <Select {...a} name="exercice" defaultValue={search.exercice ?? ""}>
              <option value="">{m.videoCollaboration.allExercises}</option>
              {exercises.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field className={field} label={m.videoCollaboration.allStates}>
        {(a) => (
          <Select {...a} name="status" defaultValue={search.status ?? ""}>
            <option value="">{m.videoCollaboration.allStates}</option>
            <option value="ready">{m.videoCollaboration.ready}</option>
            <option value="uploading">{m.video.uploading}</option>
            <option value="processing">{m.video.processing}</option>
            <option value="error">{m.video.failed}</option>
          </Select>
        )}
      </Field>
      {/* La case dessinée des autres écrans : 24 px de cible, dans une ligne de 44 px. */}
      {staff ? (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="check"
            name="review"
            value="pending"
            defaultChecked={search.review === "pending"}
          />
          {m.videoCollaboration.awaitingReview}
        </label>
      ) : null}
      {/* Dans la feuille, l'application des filtres est l'action principale. */}
      <Button type="submit" size={sheet ? "md" : "sm"} variant={sheet ? "primary" : "secondary"}>
        {m.videoCollaboration.applyFilters}
      </Button>
    </form>
  );
}

export function VideoPagination({
  search,
  nextCursor,
  basePath,
}: {
  search: VideoSearch;
  nextCursor: string | null;
  basePath: string;
}) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (search[key]) params.set(key, search[key]);
  const first = `${basePath}?${params}`;
  if (nextCursor) params.set("cursor", nextCursor);
  return (
    <nav aria-label={m.videoCollaboration.nextPage} className="flex flex-wrap gap-2">
      {search.cursor ? (
        <Button asChild variant="quiet" size="sm">
          <Link href={first}>{m.videoCollaboration.previousPage}</Link>
        </Button>
      ) : null}
      {nextCursor ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={`${basePath}?${params}`}>{m.videoCollaboration.nextPage}</Link>
        </Button>
      ) : null}
    </nav>
  );
}
