type Deps = {
  // Recherché à la demande : après un redémarrage, la mémoire ne connaît plus le jeton.
  currentToken: () => Promise<string | null>;
  unregisterOnServer: (token: string) => Promise<unknown>;
  unregisterOnDevice: () => Promise<unknown>;
};

// Un téléphone déconnecté ne reçoit plus rien, même sans réseau au moment de la déconnexion :
// le retrait côté serveur est tenté, et l'appareil se désinscrit quoi qu'il arrive.
export const forgetDevicePush = async (deps: Deps): Promise<void> => {
  const token = await deps.currentToken().catch(() => null);
  if (token) await deps.unregisterOnServer(token).catch(() => undefined);
  await deps.unregisterOnDevice().catch(() => undefined);
};

export const stopDevicePush = (deps: Pick<Deps, "unregisterOnDevice">): Promise<unknown> =>
  deps.unregisterOnDevice().catch(() => undefined);
