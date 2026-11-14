import {
  saveScheduledSessionInput,
  sessionBuilderContext,
  sessionDraft,
  sessionDraftBlock,
  editableSessionSequence,
  sessionEditResponse,
} from "@tartan/contracts";
import { prescriptionFieldsSchema } from "./form";
import { z } from "zod";
import { createChunkedStore, toAsciiJson, type KeyValueStore } from "../../lib/sync/queue-core";

// Les champs encore incomplets doivent survivre à une fermeture. Leur validation métier
// reste celle de l'API au moment de l'enregistrement, pas celle de ce cache de saisie.
const editable = saveScheduledSessionInput.extend({
  date: z.string().max(100),
  startTime: z.string().max(100).nullable(),
  publishAt: z.string().max(100).nullable(),
  draft: sessionDraft.extend({
    title: z.string().max(120),
    blocks: z
      .array(sessionDraftBlock.extend({ name: z.string().max(80), sequence: editableSessionSequence.optional() }))
      .min(1)
      .max(12),
  }),
});
export const builderDraft = z.object({
  schemaVersion: z.literal(1),
  prescription: z
    .object({ itemRef: z.string().min(1).max(100), athleteId: z.uuid().optional(), fields: prescriptionFieldsSchema })
    .optional(),
  form: editable,
  duration: z.string().max(100),
  base: sessionEditResponse.nullable(),
  context: sessionBuilderContext,
  // Écrit avant l'appel réseau : une fermeture pendant une création ne doit pas
  // autoriser une deuxième création aveugle à la prochaine ouverture.
  pending: z.enum(["save", "publish"]).nullable(),
});
export type BuilderDraft = z.infer<typeof builderDraft>;
const envelope = z.object({ revision: z.string().min(1), expiresAt: z.number(), value: builderDraft });
export type StoredBuilderDraft = z.infer<typeof envelope>;
export const BUILDER_DRAFT_TTL = 7 * 24 * 3600 * 1000;
export class BuilderStorageConflict extends Error {
  constructor() {
    super("BUILDER_DRAFT_CONFLICT");
  }
}
export class BuilderStorageCorrupted extends Error {
  constructor() {
    super("BUILDER_DRAFT_CORRUPTED");
  }
}
export const builderDraftKey = (userId: string, orgId: string, routeId: string) => {
  if ([userId, orgId, routeId].some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error("INVALID_DRAFT_SCOPE");
  return `tartan.builder.${userId}.${orgId}.${routeId}`;
};

export const createBuilderDraftStore = (backend: KeyValueStore, revisionId: () => string, now = Date.now) => {
  const chunks = createChunkedStore(backend);
  // Verrou couvrant lecture + comparaison + écriture, distinct du verrou des morceaux.
  const locks = new Map<string, Promise<unknown>>();
  const serial = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const next = (locks.get(key) ?? Promise.resolve()).catch(() => undefined).then(run);
    locks.set(key, next);
    void next
      .finally(() => {
        if (locks.get(key) === next) locks.delete(key);
      })
      .catch(() => undefined);
    return next;
  };
  const read = async (key: string): Promise<StoredBuilderDraft | null> => {
    const raw = await chunks.read(key);
    if (!raw) return null;
    let result: ReturnType<typeof envelope.safeParse>;
    try {
      result = envelope.safeParse(JSON.parse(raw));
    } catch {
      throw new BuilderStorageCorrupted();
    }
    if (!result.success) throw new BuilderStorageCorrupted();
    if (result.data.expiresAt <= now()) {
      await chunks.remove(key);
      return null;
    }
    return result.data;
  };
  const write = async (key: string, value: BuilderDraft, expectedRevision: string | null) => {
    const current = await read(key);
    if ((current?.revision ?? null) !== expectedRevision) throw new BuilderStorageConflict();
    const next = { revision: revisionId(), expiresAt: now() + BUILDER_DRAFT_TTL, value: builderDraft.parse(value) };
    await chunks.write(key, toAsciiJson(next));
    return next;
  };
  const remove = async (key: string, expectedRevision: string | null) => {
    const current = await read(key);
    if ((current?.revision ?? null) !== expectedRevision) throw new BuilderStorageConflict();
    await chunks.remove(key);
  };
  return {
    read: (key: string) => serial(key, () => read(key)),
    write: (key: string, value: BuilderDraft, expectedRevision: string | null) =>
      serial(key, () => write(key, value, expectedRevision)),
    remove: (key: string, expectedRevision: string | null) => serial(key, () => remove(key, expectedRevision)),
    // Chaque écran garde sa révision ; toutes ses écritures entrent immédiatement
    // dans le verrou partagé, y compris avant un arrêt ou une nouvelle lecture.
    writer: (key: string, initialRevision: string | null) => {
      let revision = initialRevision;
      return {
        write: (value: BuilderDraft) =>
          serial(key, async () => {
            const saved = await write(key, value, revision);
            revision = saved.revision;
            return saved;
          }),
        remove: () =>
          serial(key, async () => {
            await remove(key, revision);
            revision = null;
          }),
      };
    },
  };
};

// La reprise suit une relecture explicite. Elle ne change ni les identités
// d'exercice ni les valeurs du coach et n'envoie aucune mutation.
export const recoveredBuilderDraft = (
  stored: BuilderDraft,
  current: BuilderDraft["base"],
  verified: boolean,
  context: BuilderDraft["context"],
): BuilderDraft => {
  if (stored.pending && !stored.form.id) throw new Error("UNCONFIRMED_CREATION");
  if (verified && stored.form.id && current?.id !== stored.form.id) throw new Error("WRONG_SESSION_RECOVERY");
  return {
    ...stored,
    form: { ...stored.form, ...(verified && current ? { id: current.id, expectedVersion: current.version } : {}) },
    base: verified ? current : stored.base,
    context,
    pending: verified ? null : stored.pending,
  };
};
