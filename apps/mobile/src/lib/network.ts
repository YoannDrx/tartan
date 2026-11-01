import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useOpQueue } from "./sync/op-queue";
import { flushUploads } from "./upload/upload-queue";

const toOnline = (state: Network.NetworkState) => state.isConnected !== false && state.isInternetReachable !== false;

const flushAll = () => {
  void useOpQueue.getState().flush();
  void flushUploads();
};

// Le retour du réseau et le retour au premier plan rejouent les files.
export const startNetworkWatcher = (): (() => void) => {
  onlineManager.setEventListener((setOnline) => {
    void Network.getNetworkStateAsync().then((state) => setOnline(toOnline(state)));
    const sub = Network.addNetworkStateListener((state) => {
      const online = toOnline(state);
      setOnline(online);
      if (online) flushAll();
    });
    return () => sub.remove();
  });
  const app = AppState.addEventListener("change", (status: AppStateStatus) => {
    focusManager.setFocused(status === "active");
    if (status === "active") flushAll();
  });
  return () => app.remove();
};

export const useIsOnline = (): boolean =>
  useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
