import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createBuilderDraftStore } from "./draft-storage";

const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
// Singleton : les écrans de construction partagent le verrou des révisions locales.
export const builderDraftStore = createBuilderDraftStore(
  {
    get: (key) => SecureStore.getItemAsync(key, options),
    set: (key, value) => SecureStore.setItemAsync(key, value, options),
    remove: (key) => SecureStore.deleteItemAsync(key, options),
  },
  randomUUID,
);
