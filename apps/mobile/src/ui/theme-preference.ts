import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export const themePreferences = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];

const KEY = "tartan.theme";

export const useThemePreference = create<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>((set) => ({
  preference: "system",
  setPreference: (preference) => {
    set({ preference });
    void AsyncStorage.setItem(KEY, preference).catch(() => undefined);
  },
}));

void AsyncStorage.getItem(KEY)
  .then((value) => {
    const saved = themePreferences.find((theme) => theme === value);
    if (saved) useThemePreference.setState({ preference: saved });
  })
  .catch(() => undefined);
