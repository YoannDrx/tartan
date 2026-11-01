import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ATTRIBUTION_WINDOW_DAYS } from "@tartan/domain";

type PendingReferralState = {
  code: string | null;
  savedAt: number | null;
  keep: (code: string) => void;
  clear: () => void;
};

// Comme le cookie du site : dernier lien ouvert, dans la fenêtre d'attribution (§ 17.4).
export const usePendingReferral = create<PendingReferralState>()(
  persist(
    (set) => ({
      code: null,
      savedAt: null,
      keep: (code) => set({ code, savedAt: Date.now() }),
      clear: () => set({ code: null, savedAt: null }),
    }),
    { name: "tartan.pending-referral", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const currentReferral = (): string | undefined => {
  const { code, savedAt } = usePendingReferral.getState();
  if (!code || !savedAt) return undefined;
  return Date.now() - savedAt <= ATTRIBUTION_WINDOW_DAYS * 86_400_000 ? code : undefined;
};
