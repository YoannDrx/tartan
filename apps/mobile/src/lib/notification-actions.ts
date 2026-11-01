import type { AthleteSessionDetail } from "@tartan/contracts";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { actionFromResponse, clientIdForAction, normalizeNotificationData } from "./notification-routes";
import { persister, queryClient } from "./query-client";
import { hydrateLastOwner, submitAttendance, submitValidation } from "./sync/op-queue";

const TASK = "tartan-notification-actions";
const handled = new Set<string>();

// La version club ou autonomie vient du cache : en arrière-plan, le cache mémoire est vide.
const cachedVariant = async (orgId: string, sessionId: string): Promise<"club" | "autonomous"> => {
  const key = ["session", orgId, sessionId];
  const inMemory = queryClient.getQueryData<AthleteSessionDetail>(key);
  if (inMemory) return inMemory.variant;
  try {
    const restored = await persister.restoreClient();
    const query = restored?.clientState.queries.find(
      (q) => q.queryKey[0] === "session" && q.queryKey[1] === orgId && q.queryKey[2] === sessionId,
    );
    return (query?.state.data as AthleteSessionDetail | undefined)?.variant ?? "club";
  } catch {
    return "club";
  }
};

// Passe par la file idempotente : sans réseau, la réponse part au prochain retour de l'app.
export const handleNotificationAction = async (response: Notifications.NotificationResponse): Promise<boolean> => {
  const { request } = response.notification;
  const data = normalizeNotificationData(request.content.data);
  const action = actionFromResponse(response.actionIdentifier, data);
  if (!action) return false;
  const key = `${request.identifier}:${response.actionIdentifier}`;
  if (handled.has(key)) return true;
  handled.add(key);
  if (!(await hydrateLastOwner())) return false;
  if (action.kind === "attendance") {
    await submitAttendance(action.orgId, action.sessionId, action.status);
  } else {
    await submitValidation(
      action.orgId,
      action.sessionId,
      { status: "done", variantDone: await cachedVariant(action.orgId, action.sessionId), sets: [] },
      clientIdForAction(request.identifier, response.actionIdentifier),
    );
  }
  await Notifications.dismissNotificationAsync(request.identifier).catch(() => undefined);
  return true;
};

// Sur Android, seule une tâche reçoit le bouton quand l'app est fermée.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data }) => {
  if (data && "actionIdentifier" in data) await handleNotificationAction(data);
});

// Sur iOS, un bouton sans ouverture relance le JS en arrière-plan et passe par l'écouteur.
export const startNotificationActions = (): void => {
  void Notifications.registerTaskAsync(TASK).catch(() => undefined);
  Notifications.addNotificationResponseReceivedListener((response) => void handleNotificationAction(response));
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => (response ? handleNotificationAction(response) : false))
    .catch(() => undefined);
};
