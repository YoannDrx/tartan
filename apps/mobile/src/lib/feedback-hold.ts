// Compteur des usages audio qui font taire les retours sensoriels (enregistrement, lecture d'un vocal).
// Module pur, sans module natif : la dictée et les vocaux s'en servent sans charger les sons.
let holds = 0;
let onIdle: (() => void) | null = null;

export const feedbackHeld = (): boolean => holds > 0;

// Appelé quand plus rien ne tient les sons : feedback.ts y rétablit la session audio ambiante.
export const whenFeedbackIdle = (callback: () => void): void => {
  onIdle = callback;
};

// Un enregistrement ou une lecture tient les sons à distance ; la fonction rendue les libère.
export const holdFeedback = (): (() => void) => {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) onIdle?.();
  };
};
