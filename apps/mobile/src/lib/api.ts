import { ApiError, createApiClient, sessionThreadPath, type SessionThreadTarget } from "@tartan/api-client";
import type { ExerciseInput } from "@tartan/contracts";
import { uploadVoiceFile } from "./voice-upload";
import { fetch as expoFetch } from "expo/fetch";
import { appVersion, nativePlatform } from "./app-version";
import { authClient } from "./auth-client";
import { config } from "./config";
import { useSession } from "./session-store";

// Seule la session qui a servi à la requête peut être déclarée expirée : une réponse tardive
// ne doit pas effacer le cookie qu'une nouvelle connexion vient d'enregistrer.
const expireIfCurrent = async (sent: string) => {
  const current = await authClient.getCookie().catch(() => "");
  if (sent && sent === current) void useSession.getState().expire();
};

const fetchWithSession: typeof fetch = async (input, init) => {
  const response = await fetch(input, { ...init, credentials: "omit" });
  if (response.status === 401) await expireIfCurrent(new Headers(init?.headers).get("Cookie") ?? "");
  return response;
};

// Les en-têtes de la session : aussi pour un téléchargement de fichier, hors du client d'API.
export const sessionHeaders = async (): Promise<Record<string, string>> => ({
  Cookie: await authClient.getCookie(),
  ...(appVersion ? { "X-Tartan-App-Version": appVersion } : {}),
  "X-Tartan-Platform": nativePlatform,
});

export const api = createApiClient({
  baseUrl: config.apiUrl,
  headers: sessionHeaders,
  fetch: fetchWithSession,
});

export const sessionThreadAudioUrl = (target: SessionThreadTarget, messageId: string) =>
  `${config.apiUrl}/api/v1${sessionThreadPath(target, { messageId, action: "audio" })}`;

export async function sendSessionThreadAudio(
  target: SessionThreadTarget,
  uri: string,
  clientId: string,
  signal: AbortSignal,
) {
  const headers = await sessionHeaders();
  const response = await uploadVoiceFile(
    `${config.apiUrl}/api/v1${sessionThreadPath(target)}`,
    "POST",
    uri,
    { ...headers, "Idempotency-Key": clientId },
    signal,
  );
  if (response.status === 401) await expireIfCurrent(headers.Cookie ?? "");
  if (!response.ok) throw new ApiError(response.status, undefined, "voice_upload_failed");
}

/**
 * Une demande au planificateur en réponse diffusée (`text/event-stream`). Le `fetch` de React Native ne lit pas un
 * corps de réponse au fil de l'eau : celui d'Expo le fait, sur iOS comme sur Android. Même session, même en-têtes.
 */
export const openPlannerStream = async (path: string, body: unknown, signal: AbortSignal) => {
  const headers = await sessionHeaders();
  const response = await expoFetch(`${config.apiUrl}/api/v1${path}`, {
    method: "POST",
    signal,
    credentials: "omit",
    headers: { ...headers, Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401) await expireIfCurrent(headers.Cookie ?? "");
  return response;
};

// Routes pas encore dans l'API client : même contrat d'erreur, même session.
const callApi = async (method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> => {
  const res = await fetchWithSession(`${config.apiUrl}/api/v1${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      Cookie: await authClient.getCookie(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = json as { message?: string; code?: string } | null;
    throw new ApiError(res.status, error?.code, error?.message ?? "Erreur réseau");
  }
  return json;
};

// Fiche complète d'un athlète, vue par le staff.
export const fetchCoachAthleteFile = (orgId: string, athleteId: string): Promise<unknown> =>
  callApi("GET", `/orgs/${orgId}/athletes/${athleteId}`);

// Création, ou modification si le corps porte `id`.
export const saveExercise = (orgId: string, body: ExerciseInput): Promise<unknown> =>
  callApi("POST", `/orgs/${orgId}/exercises`, body);
