import { m } from "@tartan/i18n";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { REST_END_KIND } from "./notification-routes";
import { createRestReminder } from "./rest-reminder";

const t = m.nativeSessionMode.restNotification;

// Une notification locale, sans aucune donnée de santé : seulement que la récupération est finie. Elle passe par le
// canal « Séances » (Android) et ne s'affiche que si l'utilisateur a déjà accepté les notifications : le mode séance
// ne demande jamais l'autorisation, la vibration et le compte à rebours restent.
const schedule = async (at: number): Promise<string | null> => {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: t.title, body: t.body, sound: true, data: { kind: REST_END_KIND } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: "seances" },
  });
};
const cancel = (id: string) => Notifications.cancelScheduledNotificationAsync(id);

/** Le rappel de fin de récupération : programmé quand l'app quitte le premier plan, retiré à son retour. */
export const useRestReminder = (endAt: number | null) => {
  const [reminder] = useState(() => createRestReminder({ schedule, cancel }));
  const end = useRef(endAt);
  useEffect(() => {
    end.current = endAt;
  }, [endAt]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reminder.clear();
      else void reminder.background(end.current, Date.now());
    });
    return () => subscription.remove();
  }, [reminder]);
  // Récupération arrêtée, terminée ou relancée : l'ancien rappel ne vaut plus. Écran quitté : plus de rappel non plus.
  useEffect(() => {
    void reminder.clear();
    return () => void reminder.clear();
  }, [endAt, reminder]);
};
