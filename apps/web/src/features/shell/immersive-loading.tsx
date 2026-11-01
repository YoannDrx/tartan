import { m } from "@tartan/i18n";

// Scène Encre dès le chargement : pas d'éclair rouge avant la vidéo ou le mode séance.
export const ImmersiveLoading = () => (
  <main role="status" aria-busy className="scene-dark flex min-h-dvh flex-col gap-4 bg-ink p-4 desktop:p-6">
    <span className="sr-only">{m.common.loading}</span>
    <div aria-hidden className="h-11 w-48 max-w-full rounded-button bg-card-raised" />
    <div aria-hidden className="aspect-video w-full max-w-[780px] rounded-card bg-card-raised" />
  </main>
);
