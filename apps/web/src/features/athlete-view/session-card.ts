// Le nom que partagent la carte d'une séance et la feuille de son écran : d'une page à l'autre, le navigateur
// sait que c'est la même chose, et l'une s'ouvre en l'autre.
export const sessionCardName = (sessionId: string) => `session-${sessionId}`;
