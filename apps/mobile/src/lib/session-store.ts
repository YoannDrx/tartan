import { create } from "zustand";
import { authClient, clearSessionCookie } from "./auth-client";
import { forgetPushToken } from "./notifications";
import { clearPersistedData } from "./query-client";

type SessionState = {
  status: "loading" | "signed-in" | "signed-out";
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  // 401 du serveur : la session n'est plus valable, on revient à la connexion sans réseau.
  expire: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  refresh: async () => {
    const cookie = await authClient.getCookie().catch(() => "");
    set({ status: cookie ? "signed-in" : "signed-out" });
  },
  signOut: async () => {
    await forgetPushToken();
    await authClient.signOut().catch(() => undefined);
    await get().expire();
  },
  expire: async () => {
    await clearSessionCookie().catch(() => undefined);
    await clearPersistedData();
    set({ status: "signed-out" });
  },
}));
