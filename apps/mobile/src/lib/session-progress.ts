import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resizeSetProgress } from "@tartan/domain";

type Sets = Record<string, boolean[]>;

type ProgressState = {
  bySession: Record<string, Sets>;
  seenCues: Record<string, string[]>;
  claimCue: (sessionId: string, key: string) => boolean;
  toggle: (sessionId: string, itemRef: string, index: number, total: number) => void;
  clear: (sessionId: string) => void;
};

// « Tes séries cochées sont gardées » : quitter le mode séance ne perd rien.
export const useSessionProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      bySession: {},
      seenCues: {},
      claimCue: (sessionId, key) => {
        const previous = get().seenCues[sessionId] ?? [];
        if (previous.includes(key)) return false;
        set({ seenCues: { ...get().seenCues, [sessionId]: [...previous, key] } });
        return true;
      },
      toggle: (sessionId, itemRef, index, total) => {
        if (!Number.isInteger(index) || index < 0 || index >= total) return;
        const session = get().bySession[sessionId] ?? {};
        const current = resizeSetProgress(session[itemRef], total);
        const next = current.map((value, i) => (i === index ? !value : value));
        set({ bySession: { ...get().bySession, [sessionId]: { ...session, [itemRef]: next } } });
      },
      clear: (sessionId) => {
        const { [sessionId]: _removed, ...rest } = get().bySession;
        const { [sessionId]: _cues, ...seenCues } = get().seenCues;
        set({ bySession: rest, seenCues });
      },
    }),
    { name: "tartan.session-progress", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
