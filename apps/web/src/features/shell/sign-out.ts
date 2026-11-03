import { authClient } from "@/lib/auth-client";
import { clearOfflinePages } from "@/features/offline/service-worker";

const forgetThisDevice = async () => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch("/api/v1/devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushToken: JSON.stringify(subscription) }),
    });
    await subscription.unsubscribe();
  } catch {
    // Navigateur sans push ou réseau coupé : la déconnexion passe quand même.
  }
};

export const signOut = async () => {
  await forgetThisDevice();
  await clearOfflinePages();
  await authClient.signOut();
  window.location.href = "/";
};
