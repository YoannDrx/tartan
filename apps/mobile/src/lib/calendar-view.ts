import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { create } from "zustand";
import { api } from "./api";
import { useMe } from "./queries";

export type NativeCalendarView = "list" | "month";
type Saved = { view: NativeCalendarView; updatedAt: string | null; dirty: boolean };

const KEY = "tartan.calendar-view";

// « week » n'existe que sur ordinateur : le téléphone le lit comme la liste.
export const nativeView = (value: string | null | undefined): NativeCalendarView =>
  value === "month" ? "month" : "list";

// Le choix le plus récent gagne ; un choix fait hors ligne reste à envoyer tant qu'il n'est pas confirmé.
export const reconcileCalendarView = (
  local: Saved,
  server: { calendarView: string | null; calendarViewUpdatedAt?: string | null } | undefined,
): Saved | null => {
  if (!server?.calendarView) return null;
  const serverAt = server.calendarViewUpdatedAt ?? null;
  if (local.updatedAt && serverAt && local.updatedAt > serverAt) return null;
  if (local.dirty && !serverAt) return null;
  return { view: nativeView(server.calendarView), updatedAt: serverAt, dirty: false };
};

const persist = (saved: Saved) => void AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => undefined);

export const useCalendarViewStore = create<Saved & { apply: (saved: Saved) => void }>((set) => ({
  view: "list",
  updatedAt: null,
  dirty: false,
  apply: (saved) => {
    set(saved);
    persist(saved);
  },
}));

void AsyncStorage.getItem(KEY)
  .then((value) => {
    if (!value) return;
    const saved = JSON.parse(value) as Partial<Saved>;
    useCalendarViewStore.setState({
      view: nativeView(saved.view),
      updatedAt: saved.updatedAt ?? null,
      dirty: saved.dirty === true,
    });
  })
  .catch(() => undefined);

const push = async (saved: Saved) => {
  if (!saved.updatedAt) return;
  try {
    await api.updatePreferences({ calendarView: saved.view, calendarViewUpdatedAt: saved.updatedAt });
    if (useCalendarViewStore.getState().updatedAt === saved.updatedAt) {
      useCalendarViewStore.getState().apply({ ...saved, dirty: false });
    }
  } catch {
    // Hors ligne : le choix reste local et repart à la prochaine lecture du profil.
  }
};

export const useCalendarView = () => {
  const me = useMe();
  const view = useCalendarViewStore((s) => s.view);
  const server = me.data?.preferences;
  useEffect(() => {
    const state = useCalendarViewStore.getState();
    const next = reconcileCalendarView(state, server);
    if (next) state.apply(next);
    else if (state.dirty) void push(state);
  }, [server, me.dataUpdatedAt]);
  return {
    view,
    setView: (next: NativeCalendarView) => {
      const saved = { view: next, updatedAt: new Date().toISOString(), dirty: true };
      useCalendarViewStore.getState().apply(saved);
      void push(saved);
    },
  };
};
