import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resizeSetProgress } from "@tartan/domain";

type Sets = Record<string, boolean[]>;

type ProgressState = {
  bySession: Record<string, Sets>;
  toggle: (sessionId: string, itemRef: string, index: number, total: number) => void;
  clear: (sessionId: string) => void;
};

// « Tes séries cochées sont gardées » : quitter le mode séance ne perd rien.
export const useSessionProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      bySession: {},
      toggle: (sessionId, itemRef, index, total) => {
        if (!Number.isInteger(index) || index < 0 || index >= total) return;
        const session = get().bySession[sessionId] ?? {};
        const current = resizeSetProgress(session[itemRef], total);
        const next = current.map((value, i) => (i === index ? !value : value));
        set({ bySession: { ...get().bySession, [sessionId]: { ...session, [itemRef]: next } } });
      },
      clear: (sessionId) => {
        const { [sessionId]: _removed, ...rest } = get().bySession;
        set({ bySession: rest });
      },
    }),
    { name: "tartan.session-progress", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
