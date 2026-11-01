import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { config } from "./config";
import { actionFromResponse, normalizeNotificationData, routeForNotification } from "./notification-routes";
import { useSpaceStore } from "./space-store";
import { m } from "@tartan/i18n";

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
    // Canal discret : la progression d'un envoi ne sonne pas à chaque mise à jour.
    await Notifications.setNotificationChannelAsync("envois", {
      name: m.mobile.uploadNotice.channel,
      description: m.mobile.uploadNotice.channelDetail,
      importance: Notifications.AndroidImportance.LOW,
    });
    await Notifications.setNotificationChannelAsync("alertes-coach", {
      name: "Alertes coach",
      description: "Douleur signalée, séances manquées",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  // Sans ouvrir l'app. Sur iOS, le déverrouillage garantit l'accès au trousseau (session et file).
  const silent = { opensAppToForeground: false, isAuthenticationRequired: true };
  await Notifications.setNotificationCategoryAsync("attendance", [
    { identifier: "attendance-yes", buttonTitle: "Oui", options: silent },
    { identifier: "attendance-no", buttonTitle: "Non", options: silent },
  ]);
  await Notifications.setNotificationCategoryAsync("validate", [
    { identifier: "validate-done", buttonTitle: "Fait", options: silent },
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

// Les boutons d'action sont traités sans ouvrir l'app (voir notification-actions.ts). Ici, seul le toucher simple navigue.
const handleTap = (response: Notifications.NotificationResponse, navigate: (route: string) => void) => {
  const data = normalizeNotificationData(response.notification.request.content.data);
  if (actionFromResponse(response.actionIdentifier, data)) return;
  if (typeof data?.organizationId === "string") useSpaceStore.getState().setActive(data.organizationId);
  navigate(routeForNotification(data));
};

export const listenToNotificationResponses = (navigate: (route: string) => void): (() => void) => {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handleTap(r, navigate));
  // Un toucher qui a lancé l'app arrive avant l'écouteur.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      handleTap(response, navigate);
      Notifications.clearLastNotificationResponse();
    })
    .catch(() => undefined);
  return () => sub.remove();
};
