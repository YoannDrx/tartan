import { expoClient, getSetCookie, storageAdapter } from "@better-auth/expo/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { config } from "./config";

const STORAGE_PREFIX = "tartan";

export const authClient = createAuthClient({
  baseURL: config.apiUrl,
  plugins: [
    magicLinkClient(),
    expoClient({ scheme: config.scheme, storagePrefix: STORAGE_PREFIX, storage: SecureStore }),
  ],
});

// Même objet SecureStore que le client : les écritures restent sérialisées et découpées.
const storage = storageAdapter(SecureStore);
const cookieKey = `${STORAGE_PREFIX}_cookie`;

// Le lien magique rouvre l'app avec le cookie de session dans l'URL : il rejoint le trousseau.
export const storeSessionCookie = async (setCookieHeader: string): Promise<void> => {
  const previous = await storage.getItemAsync(cookieKey);
  await storage.setItemAsync(cookieKey, getSetCookie(setCookieHeader, previous ?? undefined));
  authClient.$store.notify("$sessionSignal");
};

export const clearSessionCookie = async (): Promise<void> => {
  await storage.setItemAsync(cookieKey, "{}");
};
