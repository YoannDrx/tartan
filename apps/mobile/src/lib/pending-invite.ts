import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PendingInviteState = {
  token: string | null;
  keep: (token: string) => void;
  clear: () => void;
};

// Le jeton survit à la connexion et au redémarrage : rouvrir le lien n'est jamais nécessaire.
export const usePendingInvite = create<PendingInviteState>()(
  persist(
    (set) => ({
      token: null,
      keep: (token) => set({ token }),
      clear: () => set({ token: null }),
    }),
    { name: "tartan.pending-invite", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
