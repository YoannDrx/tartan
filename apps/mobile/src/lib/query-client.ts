import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, type Query } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { isPersistedCalendarRange } from "./calendar-range";

export const WEEK_MS = 7 * 24 * 3600 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: WEEK_MS,
      staleTime: 30_000,
      // Le cache répond d'abord : un stade sans réseau n'affiche jamais un écran vide inutilement.
      networkMode: "offlineFirst",
      retry: (count, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return count < 2;
      },
    },
    mutations: { networkMode: "always" },
  },
});

// Seules ces requêtes vont sur le téléphone. La grille de suivi et les alertes, qui portent
// des données de santé d'autres personnes, restent en mémoire.
const PERSISTED = new Set([
  "me",
  "today",
  "session",
  "athlete-calendar",
  "announcements",
  "athletes",
  "groups",
  "coach-calendar",
  "exercises",
  "exercise-guide-illustration",
]);

const CALENDARS = new Set(["athlete-calendar", "coach-calendar"]);

export const shouldPersistQuery = (query: Query): boolean => {
  const name = String(query.queryKey[0]);
  if (query.state.status !== "success" || !PERSISTED.has(name)) return false;
  return !CALENDARS.has(name) || isPersistedCalendarRange(String(query.queryKey[2]), String(query.queryKey[3]));
};

// Effort ressenti, douleur et commentaire ne quittent pas la mémoire en clair (§ 15.2).
const HEALTH_KEYS = new Set(["rpe", "pain", "comment"]);

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "tartan.query-cache",
  throttleTime: 1000,
  serialize: (client) => JSON.stringify(client, (key, value) => (HEALTH_KEYS.has(key) ? undefined : value)),
});

export const clearPersistedData = async (): Promise<void> => {
  queryClient.clear();
  await persister.removeClient();
};
