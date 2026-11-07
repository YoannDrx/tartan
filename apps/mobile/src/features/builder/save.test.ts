import { prescriptionFields } from "./form";
import { expect, it, vi } from "vitest";
import type { SessionEditResponse } from "@tartan/contracts";
import { BuilderSaveFailure, persistBuilderSession } from "./save";
import type { BuilderDraft } from "./draft-storage";

const setup = () => {
  const draft: BuilderDraft = {
    schemaVersion: 1,
    form: {
      date: "2030-06-12",
      startTime: null,
      location: null,
      publishAt: null,
      assignments: [],
      overrides: [],
      draft: {
        title: "Force",
        type: "strength",
        durationMin: null,
        coachNote: null,
        blocks: [{ ref: "b", name: "Force", variant: "club", items: [] }],
      },
    },
    duration: "",
    context: { exercises: [], groups: [], athletes: [], templates: [], testKeys: [] },
    base: null,
    pending: null,
  };
  const current: SessionEditResponse = {
    ...draft.form,
    id: "saved",
    version: 2,
    expectedVersion: 2,
    publishedAt: "2030-06-01T00:00:00.000Z",
    logCount: 0,
  };
  const transport = {
    createSession: vi.fn(async () => ({ id: "saved", version: 1 })),
    updateSession: vi.fn(async () => ({ id: "saved", version: 2 })),
    publishSession: vi.fn(async () => ({ id: "saved" })),
    editSession: vi.fn(async () => current),
  };
  let stored: BuilderDraft | null = null;
  const writer = {
    write: vi.fn(async (value: BuilderDraft) => {
      stored = structuredClone(value);
    }),
    remove: vi.fn(async () => {
      stored = null;
    }),
  };
  const input = {
    orgId: "org",
    parsed: draft.form,
    draft,
    publish: true,
    published: false,
    transport,
    writer,
    active: () => true,
    onSaved: vi.fn(),
  };
  return { input, transport, writer, stored: () => stored };
};
it("n'envoie rien tant que la copie préalable n'est pas durable", async () => {
  const a = setup();
  a.writer.write.mockRejectedValue(new Error("FULL"));
  await expect(persistBuilderSession(a.input)).rejects.toMatchObject({ networkStarted: false, saved: null });
  expect(a.transport.createSession).not.toHaveBeenCalled();
});
it("une publication en panne conserve l'identité créée et ne recrée pas au nouvel essai explicite", async () => {
  const a = setup();
  a.transport.publishSession.mockRejectedValueOnce(new Error("OFFLINE"));
  await expect(persistBuilderSession(a.input)).rejects.toMatchObject({
    networkStarted: true,
    saved: { id: "saved", version: 1 },
  });
  expect(a.stored()).toMatchObject({ pending: "publish", form: { id: "saved", expectedVersion: 1 } });
  const recovered = a.stored()!;
  await persistBuilderSession({ ...a.input, draft: recovered, parsed: recovered.form });
  expect(a.transport.createSession).toHaveBeenCalledTimes(1);
  expect(a.transport.updateSession).toHaveBeenCalledTimes(1);
});
it("une déconnexion pendant la réponse conserve l'identité sans publier sous une autre session", async () => {
  const a = setup();
  let active = true;
  a.transport.createSession.mockImplementation(async () => {
    active = false;
    return { id: "saved", version: 1 };
  });
  expect(await persistBuilderSession({ ...a.input, active: () => active })).toBeNull();
  expect(a.stored()?.form.id).toBe("saved");
  expect(a.transport.publishSession).not.toHaveBeenCalled();
  expect(a.transport.editSession).not.toHaveBeenCalled();
});
it("une réponse de création perdue laisse un marqueur sans lancer de deuxième demande", async () => {
  const a = setup();
  a.transport.createSession.mockRejectedValue(new Error("LOST"));
  await expect(persistBuilderSession(a.input)).rejects.toBeInstanceOf(BuilderSaveFailure);
  expect(a.stored()).toMatchObject({ pending: "save" });
  expect(a.stored()?.form.id).toBeUndefined();
  expect(a.transport.createSession).toHaveBeenCalledTimes(1);
});
it("un nettoyage local raté ne transforme pas une publication confirmée en échec serveur", async () => {
  const a = setup();
  a.writer.remove.mockRejectedValue(new Error("FULL"));
  expect(await persistBuilderSession(a.input)).toMatchObject({
    cleanupFailed: true,
    current: { id: "saved", version: 2 },
  });
  expect(a.stored()).toMatchObject({ pending: null, form: { id: "saved", expectedVersion: 2 } });
});
it("le refus de stockage de l'identité reçue empêche la publication, tout en exposant l'identité à l'écran", async () => {
  const a = setup();
  a.writer.write.mockImplementationOnce(async () => {}).mockRejectedValue(new Error("FULL"));
  await expect(persistBuilderSession(a.input)).rejects.toMatchObject({ saved: { id: "saved", version: 1 } });
  expect(a.input.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "saved", expectedVersion: 1 }));
  expect(a.transport.publishSession).not.toHaveBeenCalled();
});

it("une prescription encore en cours de saisie n'est pas ignorée lors de la publication", async () => {
  const a = setup();
  await expect(
    persistBuilderSession({
      ...a.input,
      draft: { ...a.input.draft, prescription: { itemRef: "item", fields: prescriptionFields({ reps: 5 }) } },
    }),
  ).rejects.toMatchObject({ networkStarted: false });
  expect(a.transport.createSession).not.toHaveBeenCalled();
});
