import Link from "next/link";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import type { VideoQuery } from "@/server/video.service";

export type VideoSearch = {
  athlete?: string;
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

export function VideoFilters({
  search,
  athletes = [],
  sessions = [],
  exercises = [],
  staff = false,
}: {
  search: VideoSearch;
  athletes?: { id: string; name: string }[];
  sessions?: { id: string; label: string }[];
  exercises?: { id: string; name: string }[];
  staff?: boolean;
}) {
  return (
    <form method="get" aria-label={m.videoCollaboration.filter} className="flex flex-wrap items-end gap-3">
      {athletes.length ? (
        <Field className="min-w-0 w-full tablet:w-56" label={m.videoCollaboration.athlete}>
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
      {sessions.length ? (
        <Field className="min-w-0 w-full tablet:w-56" label={m.video.linkedSession}>
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
        <Field className="min-w-0 w-full tablet:w-56" label={m.video.exerciseLink}>
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
      <Field className="min-w-0 w-full tablet:w-56" label={m.videoCollaboration.allStates}>
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
      {staff ? (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="review" value="pending" defaultChecked={search.review === "pending"} />
          {m.videoCollaboration.awaitingReview}
        </label>
      ) : null}
      <Button type="submit" size="sm" variant="secondary">
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
  for (const key of ["athlete", "exercice", "session", "status", "review"] as const)
    if (search[key]) params.set(key, search[key]);
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
