import { ApiError, createApiClient } from "@tartan/api-client";
import type { ExerciseInput } from "@tartan/contracts";
import { appVersion, nativePlatform } from "./app-version";
import { authClient } from "./auth-client";
import { config } from "./config";
import { useSession } from "./session-store";

const fetchWithSession: typeof fetch = async (input, init) => {
  const response = await fetch(input, { ...init, credentials: "omit" });
  if (response.status === 401) {
    // Seule la session qui a servi à la requête peut être déclarée expirée : une réponse tardive
    // ne doit pas effacer le cookie qu'une nouvelle connexion vient d'enregistrer.
    const sent = new Headers(init?.headers).get("Cookie") ?? "";
    const current = await authClient.getCookie().catch(() => "");
    if (sent && sent === current) void useSession.getState().expire();
  }
  return response;
};

export const api = createApiClient({
  baseUrl: config.apiUrl,
  headers: async () => ({
    Cookie: await authClient.getCookie(),
    ...(appVersion ? { "X-Tartan-App-Version": appVersion } : {}),
    "X-Tartan-Platform": nativePlatform,
  }),
  fetch: fetchWithSession,
});

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

