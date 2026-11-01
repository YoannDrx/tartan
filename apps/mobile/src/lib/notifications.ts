import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { config } from "./config";
import { actionFromResponse, routeForNotification, type NotificationData } from "./notification-routes";
import { queryClient } from "./query-client";
import { useSpaceStore } from "./space-store";
import { submitAttendance, submitValidation } from "./sync/op-queue";
import type { AthleteSessionDetail } from "@tartan/contracts";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Canaux réglables par l'utilisateur et boutons d'action, déclarés une seule fois au démarrage.
export const setupNotificationChannels = async (): Promise<void> => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("seances", {
      name: "Séances",
      description: "Nouvelle séance, rappel, séance modifiée, annonces",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync("videos", {
      name: "Vidéos",
      description: "Vidéo partagée et commentaires",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync("alertes-coach", {
      name: "Alertes coach",
      description: "Douleur signalée, séances manquées",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync("attendance", [
    { identifier: "attendance-yes", buttonTitle: "Oui", options: { opensAppToForeground: true } },
    { identifier: "attendance-no", buttonTitle: "Non", options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync("validate", [
    { identifier: "validate-done", buttonTitle: "Fait", options: { opensAppToForeground: true } },
  ]);
};

export type PushPermission = "granted" | "denied" | "undetermined";

export const getPushPermission = async (): Promise<PushPermission> => {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return "granted";
  return status.canAskAgain ? "undetermined" : "denied";
};

// Avec « prompt », demande l'autorisation ; sinon rafraîchit seulement un jeton déjà permis,
// pour qu'aucun lancement n'affiche de boîte de dialogue système.
export const registerPush = async ({ prompt }: { prompt: boolean }): Promise<PushPermission> => {
  let permission = await getPushPermission();
  if (permission === "undetermined" && prompt) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    permission = asked.granted ? "granted" : asked.canAskAgain ? "undetermined" : "denied";
  }
  if (permission !== "granted") return permission;
  try {
    const token = await Notifications.getExpoPushTokenAsync(
      config.projectId ? { projectId: config.projectId } : undefined,
    );
    await api.registerDevice(token.data, Platform.OS === "ios" ? "ios" : "android");
  } catch {
    // Simulateur ou projet EAS pas encore créé : l'app marche sans notification.
  }
  return permission;
};

const handleResponse = (response: Notifications.NotificationResponse, navigate: (route: string) => void) => {
  const data = response.notification.request.content.data as NotificationData | null;
  if (typeof data?.organizationId === "string") useSpaceStore.getState().setActive(data.organizationId);
  const action = actionFromResponse(response.actionIdentifier, data);
  if (action?.kind === "attendance") {
    void submitAttendance(action.orgId, action.sessionId, action.status);
    navigate("/today");
    return;
  }
  if (action?.kind === "validate") {
    const cached = queryClient.getQueryData<AthleteSessionDetail>(["session", action.orgId, action.sessionId]);
    void submitValidation(action.orgId, action.sessionId, {
      status: "done",
      variantDone: cached?.variant ?? "club",
      sets: [],
    });
    navigate("/today");
    return;
  }
  navigate(routeForNotification(data));
};

export const listenToNotificationResponses = (navigate: (route: string) => void): (() => void) => {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handleResponse(r, navigate));
  // Un toucher qui a lancé l'app arrive avant l'écouteur.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      handleResponse(response, navigate);
      Notifications.clearLastNotificationResponse();
    })
    .catch(() => undefined);
  return () => sub.remove();
};
