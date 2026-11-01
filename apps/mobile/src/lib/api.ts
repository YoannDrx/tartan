import { createApiClient } from "@tartan/api-client";
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
  headers: async () => ({ Cookie: await authClient.getCookie() }),
  fetch: fetchWithSession,
});
