import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { clientVersionInfo, nativePlatform, appVersion, installationId, updateId } from "./app-version";
import { config } from "./config";
import { launchRoute } from "./notification-launch";
import { forgetDevicePush, stopDevicePush } from "./push-lifecycle";
import { reportTechnical } from "./report";
import { actionFromResponse, normalizeNotificationData, routeForNotification } from "./notification-routes";
import { useSpaceStore } from "./space-store";
import { m } from "@tartan/i18n";

const pushDeps = {
  currentToken: async () => {
    const status = await Notifications.getPermissionsAsync();
    if (!status.granted) return null;
    const token = await Notifications.getExpoPushTokenAsync(
      config.projectId ? { projectId: config.projectId } : undefined,
    );
    return token.data;
  },
  unregisterOnServer: (token: string) => api.unregisterDevice(token),
  unregisterOnDevice: () => Notifications.unregisterForNotificationsAsync(),
};

// À la déconnexion : cet appareil ne reçoit plus rien pour ce compte.
export const forgetPushToken = (): Promise<void> => forgetDevicePush(pushDeps);

// Session expirée : le serveur ne répondra plus, seul l'appareil peut encore se couper.
export const stopPushOnDevice = (): Promise<unknown> => stopDevicePush(pushDeps);

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
      name: m.mobile.channels.sessions,
      description: m.mobile.channels.sessionsDetail,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync("videos", {
      name: m.mobile.channels.videos,
      description: m.mobile.channels.videosDetail,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    // Canal discret : la progression d'un envoi ne sonne pas à chaque mise à jour.
    await Notifications.setNotificationChannelAsync("envois", {
      name: m.mobile.uploadNotice.channel,
      description: m.mobile.uploadNotice.channelDetail,
      importance: Notifications.AndroidImportance.LOW,
    });
    await Notifications.setNotificationChannelAsync("mises-a-jour", {
      name: m.mobile.channels.updates,
      description: m.mobile.channels.updatesDetail,
      importance: Notifications.AndroidImportance.LOW,
    });
    await Notifications.setNotificationChannelAsync("alertes-coach", {
      name: m.mobile.channels.alerts,
      description: m.mobile.channels.alertsDetail,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  // Sans ouvrir l'app. Sur iOS, le déverrouillage garantit l'accès au trousseau (session et file).
  const silent = { opensAppToForeground: false, isAuthenticationRequired: true };
  await Notifications.setNotificationCategoryAsync("attendance", [
    { identifier: "attendance-yes", buttonTitle: m.mobile.channels.yes, options: silent },
    { identifier: "attendance-no", buttonTitle: m.mobile.channels.no, options: silent },
  ]);
  await Notifications.setNotificationCategoryAsync("validate", [
    { identifier: "validate-done", buttonTitle: m.status.done, options: silent },
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
    await api.registerDevice(token.data, Platform.OS === "ios" ? "ios" : "android", await clientVersionInfo());
  } catch (error) {
    // L'app marche sans notification, mais un échec sur un vrai téléphone doit se voir.
    reportTechnical("push_token_failed", error);
  }
  return permission;
};

// Un jeton renouvelé par le système doit remplacer l'ancien, sinon l'appareil cesse de recevoir.
export const listenToPushToken = (): (() => void) => {
  const sub = Notifications.addPushTokenListener(() => void registerPush({ prompt: false }));
  return () => sub.remove();
};

// Connaître la version de chaque installation, y compris sans autorisation de notification.
export const reportClientVersion = async (): Promise<void> => {
  if (!appVersion) return;
  await api
    .checkIn({ installationId: await installationId(), platform: nativePlatform, appVersion, updateId: updateId() })
    .catch(() => undefined);
};

// Les boutons d'action sont traités sans ouvrir l'app (voir notification-actions.ts). Ici, seul le toucher simple navigue.
const handleTap = (response: Notifications.NotificationResponse, navigate: (route: string) => void) => {
  const data = normalizeNotificationData(response.notification.request.content.data);
  if (actionFromResponse(response.actionIdentifier, data)) return;
  if (typeof data?.organizationId === "string") useSpaceStore.getState().setActive(data.organizationId);
  launchRoute.offer(routeForNotification(data), navigate);
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
