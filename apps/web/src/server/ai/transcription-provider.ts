import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { plannerAudioIsWithinLimits, plannerServerEnabled } from "@tartan/domain";
import type { PlannerAudio } from "./audio";
import { PlannerProviderError } from "./provider";

export interface PlannerTranscriptionProvider {
  transcribe(audio: PlannerAudio): Promise<string>;
}
const transcript = z.object({ text: z.string().trim().min(1).max(12000) });
// Lexique public, sans nom de personne ni résultat individuel. Ce sont des
// indices de transcription ; le rattachement reste réservé à la bibliothèque.
const vocabulary = [
  "squat arrière",
  "squat avant",
  "soulevé de terre",
  "développé couché",
  "épaulé",
  "pliométrie",
  "foulées bondissantes",
  "sprint",
  "RPE",
  "RIR",
  "répétitions",
  "récupération",
];
const CONTEXT = "Dictée d'une séance de préparation physique pour l'athlétisme.";

// Le workflow réserve le quota avant cet appel. Aucun stockage audio, aucune
// consigne privée ajoutée au prompt et aucune relance payante automatique.
export function openAiTranscriptionProvider(fetcher: typeof fetch = fetch): PlannerTranscriptionProvider {
  return {
    async transcribe(audio) {
      const settings = env();
      if (!plannerServerEnabled(settings)) throw new PlannerProviderError("disabled");
      const key = settings.OPENAI_API_KEY ?? settings.OPEN_AI_API_KEY;
      if (!key || !plannerAudioIsWithinLimits(audio.bytes.byteLength, audio.durationSeconds))
        throw new PlannerProviderError("configuration");
      const body = new FormData();
      body.set("file", new Blob([audio.bytes], { type: audio.mimeType }), `dictee.${audio.extension}`);
      body.set("model", settings.AI_TRANSCRIPTION_MODEL);
      body.set("response_format", "json");
      // gpt-transcribe, le défaut, prend la langue dans languages[], les termes attendus dans keywords[] et le
      // contexte libre dans prompt. Les modèles historiques, arrêtés le 26 février 2027, n'ont que language et prompt.
      if (settings.AI_TRANSCRIPTION_MODEL.startsWith("gpt-transcribe")) {
        body.set("languages[]", "fr");
        for (const word of vocabulary) body.append("keywords[]", word);
        body.set("prompt", CONTEXT);
      } else {
        body.set("language", "fr");
        body.set("prompt", `${CONTEXT} Vocabulaire possible : ${vocabulary.join(", ")}.`);
      }
      let response: Response;
      try {
        response = await fetcher("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body,
          signal: AbortSignal.timeout(90000),
        });
      } catch {
        throw new PlannerProviderError("unavailable");
      }
      if (!response.ok) throw new PlannerProviderError("unavailable");
      const result = transcript.safeParse(await response.json().catch(() => null));
      if (!result.success) throw new PlannerProviderError("invalid_output");
      return result.data.text;
    },
  };
}
