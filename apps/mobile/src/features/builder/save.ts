import type { SaveScheduledSessionInput, SessionEditResponse } from "@tartan/contracts";
import type { api } from "../../lib/api";
import type { BuilderDraft } from "./draft-storage";
import { localSchedule } from "./form";

type Transport = Pick<typeof api, "createSession" | "updateSession" | "publishSession" | "editSession">;
type Receipt = { id: string; version: number };
export class BuilderSaveFailure extends Error {
  constructor(
    readonly original: unknown,
    readonly networkStarted: boolean,
    readonly saved: Receipt | null,
  ) {
    super("BUILDER_SAVE_FAILED");
  }
}
// Aucun rejeu automatique. Une copie durable précède chaque étape qui pourrait
// devenir indéterminée si le téléphone s'arrête pendant la réponse.
export const persistBuilderSession = async (input: {
  orgId: string;
  parsed: SaveScheduledSessionInput;
  draft: BuilderDraft;
  publish: boolean;
  published: boolean;
  transport: Transport;
  writer: { write: (value: BuilderDraft) => Promise<unknown>; remove: () => Promise<void> };
  active: () => boolean;
  onSaved: (next: SaveScheduledSessionInput) => void;
}) => {
  const { orgId, parsed, draft, publish, published, transport, writer, active, onSaved } = input;
  if (draft.prescription) throw new BuilderSaveFailure(new Error("UNAPPLIED_PRESCRIPTION"), false, null);
  let networkStarted = false;
  let saved: Receipt | null = null;
  try {
    await writer.write({ ...draft, pending: "save" });
    if (!active()) {
      await writer.write({ ...draft, pending: null });
      return null;
    }
    const { id, expectedVersion, ...body } = parsed;
    networkStarted = true;
    saved =
      id && expectedVersion
        ? await transport.updateSession(orgId, id, { ...body, expectedVersion })
        : await transport.createSession(orgId, body);
    const next = {
      ...parsed,
      publishAt: localSchedule(parsed.publishAt),
      id: saved.id,
      expectedVersion: saved.version,
    };
    if (active()) onSaved(next);
    await writer.write({ ...draft, form: next, pending: publish && !published ? "publish" : "save" });
    if (!active()) return null;
    if (publish && !published) await transport.publishSession(orgId, saved.id, saved.version);
    if (!active()) return null;
    const current: SessionEditResponse = await transport.editSession(orgId, saved.id);
    const refreshed: SaveScheduledSessionInput = {
      id: current.id,
      expectedVersion: current.version,
      date: current.date,
      startTime: current.startTime,
      location: current.location,
      publishAt: localSchedule(current.publishAt),
      draft: current.draft,
      assignments: current.assignments,
      overrides: current.overrides,
    };
    await writer.write({ ...draft, form: refreshed, base: current, pending: null });
    let cleanupFailed = false;
    try {
      await writer.remove();
    } catch {
      cleanupFailed = true;
    }
    return { current, form: refreshed, cleanupFailed };
  } catch (cause) {
    throw new BuilderSaveFailure(cause, networkStarted, saved);
  }
};
