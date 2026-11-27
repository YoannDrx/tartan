import AsyncStorage from "@react-native-async-storage/async-storage";
import { feedback, type FeedbackCue, type FeedbackHaptic } from "@tartan/design-tokens";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { create } from "zustand";
import { feedbackHeld, whenFeedbackIdle } from "./feedback-hold";

export { holdFeedback } from "./feedback-hold";

// Retours sensoriels de l'app native (DESIGN.md, « Mouvement et son ») : un retour haptique et un son court.
// Les sons viennent de `@tartan/design-tokens` (scripts/build-sounds.ts). Activés par défaut, coupables sur cet
// appareil (Réglages, Apparence). Le mode silencieux d'iOS les coupe ; jamais pendant un enregistrement ou une lecture.

const KEY = "tartan.sounds";

const sources: Record<FeedbackCue, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  select: require("../../assets/sounds/select.wav"),
  toggle: require("../../assets/sounds/toggle.wav"),
  setDone: require("../../assets/sounds/setDone.wav"),
  success: require("../../assets/sounds/success.wav"),
  restEnd: require("../../assets/sounds/restEnd.wav"),
  error: require("../../assets/sounds/error.wav"),
};

export const useSoundPreference = create<{ enabled: boolean; setEnabled: (enabled: boolean) => void }>((set) => ({
  enabled: true,
  setEnabled: (enabled) => {
    set({ enabled });
    void AsyncStorage.setItem(KEY, enabled ? "on" : "off").catch(() => undefined);
  },
}));

void AsyncStorage.getItem(KEY)
  .then((value) => {
    if (value === "off") useSoundPreference.setState({ enabled: false });
  })
  .catch(() => undefined);

// Session audio « ambiante » : nos sons se mêlent à la musique de l'utilisateur sans la couper, et le mode
// silencieux d'iOS les fait taire. Un vocal ou une dictée change ce mode le temps de son usage ; on le rétablit après.
const ambient = () =>
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", allowsRecording: false }).catch(
    () => undefined,
  );
void ambient();
whenFeedbackIdle(() => void ambient());

const players = new Map<FeedbackCue, AudioPlayer>();
const playerFor = (cue: FeedbackCue): AudioPlayer => {
  const known = players.get(cue);
  if (known) return known;
  const player = createAudioPlayer(sources[cue]);
  player.volume = 0.8;
  players.set(cue, player);
  return player;
};

const haptic = (kind: FeedbackHaptic): Promise<void> => {
  switch (kind) {
    case "light":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case "medium":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "selection":
      return Haptics.selectionAsync();
    case "success":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "warning":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case "error":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

// Le retour suit le geste sans jamais le retarder : rien n'est attendu, toute erreur est ignorée.
export const playFeedback = (cue: FeedbackCue): void => {
  if (feedbackHeld()) return;
  void haptic(feedback[cue].haptic).catch(() => undefined);
  if (!useSoundPreference.getState().enabled) return;
  try {
    const player = playerFor(cue);
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Son indisponible : le retour haptique a déjà eu lieu.
  }
};
