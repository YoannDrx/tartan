import { prescriptionFields } from "./form";
import { expect, it } from "vitest";
import {
  builderDraftKey,
  recoveredBuilderDraft,
  BUILDER_DRAFT_TTL,
  BuilderStorageConflict,
  BuilderStorageCorrupted,
  createBuilderDraftStore,
  type BuilderDraft,
} from "./draft-storage";

const draft = (): BuilderDraft => ({
  schemaVersion: 1,
  form: {
    date: "2030-02-",
    startTime: "18:",
    location: null,
    publishAt: null,
    assignments: [],
    overrides: [],
    draft: {
      title: "",
      type: "strength",
      durationMin: null,
      coachNote: "Consigne à relire",
      blocks: [{ ref: "warmup", name: "", variant: "club", items: [] }],
    },
  },
  duration: "4,",
  context: { exercises: [], athletes: [], groups: [], templates: [], testKeys: [] },
  base: null,
  pending: null,
});
const setup = () => {
  const disk = new Map<string, string>();
  let n = 0;
  let clock = 100;
  let failHead = false;
  const store = createBuilderDraftStore(
    {
      get: async (key) => disk.get(key) ?? null,
      set: async (key, value) => {
        if (failHead && key.endsWith(".head")) throw new Error("FULL");
        disk.set(key, value);
      },
      remove: async (key) => {
        disk.delete(key);
      },
    },
    () => String(++n),
    () => clock,
  );
  return {
    store,
    disk,
    fail: () => {
      failHead = true;
    },
    advance: () => {
      clock += BUILDER_DRAFT_TTL + 1;
    },
  };
};
it("retrouve les champs incomplets et le marqueur réseau sans les normaliser", async () => {
  const { store } = setup();
  const value = { ...draft(), pending: "save" as const };
  await store.write("a", value, null);
  expect((await store.read("a"))?.value).toEqual(value);
});
it("sépare les comptes, espaces et nouvelles séances des modifications", async () => {
  const { store } = setup();
  const key = builderDraftKey("alice", "club", "new");
  await store.write(key, draft(), null);
  for (const other of [
    builderDraftKey("bob", "club", "new"),
    builderDraftKey("alice", "other", "new"),
    builderDraftKey("alice", "club", "saved"),
  ])
    expect(await store.read(other)).toBeNull();
  expect(() => builderDraftKey("a.b", "club", "new")).toThrow();
});
it("deux écrans ne peuvent pas écraser mutuellement leur première saisie", async () => {
  const { store } = setup();
  const results = await Promise.allSettled([
    store.write("a", draft(), null),
    store.write("a", { ...draft(), duration: "50" }, null),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(
    BuilderStorageConflict,
  );
  expect((await store.read("a"))?.value.duration).toBe("4,");
});
it("une panne pendant le remplacement conserve la génération précédente", async () => {
  const { store, fail } = setup();
  const original = await store.write("a", draft(), null);
  fail();
  await expect(store.write("a", { ...draft(), duration: "50" }, original.revision)).rejects.toThrow("FULL");
  expect(await store.read("a")).toEqual(original);
});
it("un nettoyage tardif ne supprime pas une saisie plus récente", async () => {
  const { store } = setup();
  const first = await store.write("a", draft(), null);
  const next = await store.write("a", { ...draft(), duration: "50" }, first.revision);
  await expect(store.remove("a", first.revision)).rejects.toBeInstanceOf(BuilderStorageConflict);
  expect(await store.read("a")).toEqual(next);
  await store.remove("a", next.revision);
  expect(await store.read("a")).toBeNull();
});
it("une valeur corrompue reste signalée et n'est pas remplacée par un brouillon vide", async () => {
  const { store, disk } = setup();
  await store.write("a", draft(), null);
  for (const key of disk.keys()) if (!key.endsWith(".head")) disk.set(key, "not-json");
  await expect(store.read("a")).rejects.toBeInstanceOf(BuilderStorageCorrupted);
  await expect(store.write("a", draft(), null)).rejects.toBeInstanceOf(BuilderStorageCorrupted);
});
it("une copie expirée n'est plus proposée et ses morceaux sont effacés", async () => {
  const { store, disk, advance } = setup();
  await store.write("a", draft(), null);
  advance();
  expect(await store.read("a")).toBeNull();
  expect([...disk.keys()].filter((k) => !k.endsWith(".head"))).toEqual([]);
});

it("la lecture attend toutes les frappes déjà en file, avant le nettoyage", async () => {
  const { store } = setup();
  const writer = store.writer("a", null);
  const first = writer.write(draft());
  const second = writer.write({ ...draft(), duration: "60" });
  expect((await store.read("a"))?.value.duration).toBe("60");
  await Promise.all([first, second]);
  await writer.remove();
  expect(await store.read("a")).toBeNull();
});
it("un deuxième écran ne peut effacer le dernier brouillon du premier", async () => {
  const { store } = setup();
  const initial = await store.write("a", draft(), null);
  const one = store.writer("a", initial.revision);
  const two = store.writer("a", initial.revision);
  await one.write({ ...draft(), duration: "60" });
  await expect(two.remove()).rejects.toBeInstanceOf(BuilderStorageConflict);
  await expect(two.write(draft())).rejects.toBeInstanceOf(BuilderStorageConflict);
  expect((await store.read("a"))?.value.duration).toBe("60");
});

it("conserve une prescription non appliquée avec une décimale inachevée", async () => {
  const { store } = setup();
  const value = {
    ...draft(),
    prescription: {
      itemRef: "b-item",
      fields: { ...prescriptionFields({ reps: 4 }), loadType: "kg" as const, loadValue: "45," },
    },
  };
  await store.write("a", value, null);
  expect((await store.read("a"))?.value.prescription?.fields.loadValue).toBe("45,");
});

it("une reprise hors ligne ne remet pas à zéro le marqueur d'envoi et ne change pas la version", () => {
  const value = { ...draft(), form: { ...draft().form, id: "saved", expectedVersion: 2 }, pending: "publish" as const };
  const result = recoveredBuilderDraft(value, null, false, value.context);
  expect(result.form.expectedVersion).toBe(2);
  expect(result.pending).toBe("publish");
});
it("la reprise relue conserve les identités et valeurs et vise exactement la version serveur", () => {
  const value = { ...draft(), form: { ...draft().form, id: "saved", expectedVersion: 2 } };
  const current = { ...value.form, id: "saved", version: 4, expectedVersion: 4, publishedAt: null, logCount: 0 };
  const result = recoveredBuilderDraft(value, current, true, value.context);
  expect(result.form.expectedVersion).toBe(4);
  expect(result.form.draft).toEqual(value.form.draft);
  expect(value.form.expectedVersion).toBe(2);
  expect(() => recoveredBuilderDraft(value, { ...current, id: "other" }, true, value.context)).toThrow(
    "WRONG_SESSION_RECOVERY",
  );
});
it("un envoi de création interrompu ne devient jamais une nouvelle création depuis le cache", () => {
  const value = { ...draft(), pending: "save" as const };
  expect(() => recoveredBuilderDraft(value, null, true, value.context)).toThrow("UNCONFIRMED_CREATION");
  expect(() => recoveredBuilderDraft(value, null, false, value.context)).toThrow("UNCONFIRMED_CREATION");
});

it("conserve un groupe vide en cours de saisie sans l'autoriser à l'enregistrement serveur", async () => {
  const { saveScheduledSessionInput } = await import("@tartan/contracts");
  const { store } = setup();
  const value = draft();
  value.form.draft.structureVersion = 2;
  value.form.draft.blocks[0]!.sequence = [
    { kind: "repeat", ref: "new-group", name: "", rounds: 0, restBetweenRoundsS: 0, children: [] },
  ];
  await store.write("circuit", value, null);
  expect((await store.read("circuit"))?.value).toEqual(value);
  expect(
    saveScheduledSessionInput.safeParse({
      ...value.form,
      date: "2030-02-12",
      startTime: null,
      draft: { ...value.form.draft, title: "Circuit" },
    }).success,
  ).toBe(false);
});
