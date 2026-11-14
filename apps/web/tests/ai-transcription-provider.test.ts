import { beforeEach, expect, it, vi } from "vitest";
import { openAiTranscriptionProvider } from "@/server/ai/transcription-provider";
import type { PlannerAudio } from "@/server/ai/audio";
const settings = vi.hoisted(() => ({
  AI_PLANNER_ENABLED: "true",
  AI_TRANSCRIPTION_MODEL: "gpt-transcribe",
  OPENAI_API_KEY: undefined as string | undefined,
  OPEN_AI_API_KEY: "test-only",
}));
vi.mock("@/lib/env", () => ({ env: () => settings }));
const audio: PlannerAudio = {
  bytes: new Uint8Array([1, 2, 3]),
  durationSeconds: 2,
  audioSeconds: 2,
  mimeType: "audio/mp4",
  extension: "m4a",
};
beforeEach(() => {
  settings.AI_PLANNER_ENABLED = "true";
  settings.AI_TRANSCRIPTION_MODEL = "gpt-transcribe";
  settings.OPENAI_API_KEY = undefined;
  settings.OPEN_AI_API_KEY = "test-only";
});
it("envoie le fichier borné sans nom personnel, avec la clé serveur et une réponse relisible", async () => {
  // Un modèle historique, encore accepté jusqu'à son arrêt le 26 février 2027.
  settings.AI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ text: " Trois séries de quatre à 40 kg. " }));
  const provider = openAiTranscriptionProvider(fetcher);
  expect(await provider.transcribe(audio)).toBe("Trois séries de quatre à 40 kg.");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
  expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-only");
  // Le runtime ajoute lui-même la frontière multipart ; aucun JSON ni base64.
  expect(new Headers(init?.headers).get("Content-Type")).toBeNull();
  const body = init?.body as FormData;
  expect([...body.keys()].sort()).toEqual(["file", "language", "model", "prompt", "response_format"]);
  expect(body.get("prompt")).toContain("squat arrière");
  const file = body.get("file") as File;
  expect(file.name).toBe("dictee.m4a");
  expect(file.type).toBe("audio/mp4");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(audio.bytes);
  expect(body.get("language")).toBe("fr");
});
it("utilise gpt-transcribe par défaut, sans mélanger language et languages", async () => {
  settings.AI_TRANSCRIPTION_MODEL = "gpt-transcribe";
  settings.OPENAI_API_KEY = "standard-test-only";
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ text: "Séance de force", languages: [{ code: "fr" }] }),
  );
  await openAiTranscriptionProvider(fetcher).transcribe(audio);
  const init = fetcher.mock.calls[0]![1]!;
  expect((init.body as FormData).get("languages[]")).toBe("fr");
  expect((init.body as FormData).has("language")).toBe(false);
  expect((init.body as FormData).getAll("keywords[]")).toContain("squat arrière");
  // Le contexte libre reste court : le vocabulaire passe par keywords[], sans chevron ni retour à la ligne.
  expect((init.body as FormData).get("prompt")).toBe("Dictée d'une séance de préparation physique pour l'athlétisme.");
  for (const word of (init.body as FormData).getAll("keywords[]")) expect(String(word)).not.toMatch(/[<>\r\n]/);
  expect(new Headers(init.headers).get("Authorization")).toBe("Bearer standard-test-only");
});
it("ajoute les noms de la bibliothèque au vocabulaire, nettoyés et bornés", async () => {
  settings.AI_TRANSCRIPTION_MODEL = "gpt-transcribe";
  settings.OPENAI_API_KEY = "standard-test-only";
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ text: "Séance de force" }));
  const library = ["Squat du dragon", "Tirage <b>Atlas</b>\nprivé", ...Array.from({ length: 80 }, (_, i) => `Fiche ${i}`)];
  await openAiTranscriptionProvider(fetcher).transcribe(audio, library);
  const keywords = (fetcher.mock.calls[0]![1]!.body as FormData).getAll("keywords[]").map(String);
  expect(keywords[0]).toBe("Squat du dragon");
  expect(keywords[1]).toBe("Tirage b Atlas /b privé");
  expect(keywords).toHaveLength(60);
  for (const word of keywords) expect(word).not.toMatch(/[<>\r\n]/);
});
it("arrêt global, absence de clé et durée excessive coupent tout appel", async () => {
  const fetcher = vi.fn<typeof fetch>();
  settings.AI_PLANNER_ENABLED = "false";
  await expect(openAiTranscriptionProvider(fetcher).transcribe(audio)).rejects.toMatchObject({ code: "disabled" });
  settings.AI_PLANNER_ENABLED = "true";
  settings.OPEN_AI_API_KEY = "";
  await expect(openAiTranscriptionProvider(fetcher).transcribe(audio)).rejects.toMatchObject({ code: "configuration" });
  settings.OPEN_AI_API_KEY = "test-only";
  await expect(
    openAiTranscriptionProvider(fetcher).transcribe({ ...audio, durationSeconds: 181 }),
  ).rejects.toMatchObject({ code: "configuration" });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([null, {}, { text: " " }, { text: "x".repeat(12001) }])(
  "refuse un résultat inutilisable sans reproduire le contenu",
  async (result) => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(result));
    await expect(openAiTranscriptionProvider(fetcher).transcribe(audio)).rejects.toMatchObject({
      message: "planner_invalid_output",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it("neutralise les erreurs prestataire et ne relance pas une requête potentiellement facturée", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response("secret-test-only et contenu privé", { status: 500 }));
  await expect(openAiTranscriptionProvider(fetcher).transcribe(audio)).rejects.toMatchObject({
    message: "planner_unavailable",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const failed = vi.fn<typeof fetch>(async () => {
    throw new Error("contenu fournisseur privé");
  });
  await expect(openAiTranscriptionProvider(failed).transcribe(audio)).rejects.toMatchObject({
    message: "planner_unavailable",
  });
  expect(failed).toHaveBeenCalledTimes(1);
});
