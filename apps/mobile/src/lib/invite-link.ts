// Sans service tiers, le lien ne survit pas à une première installation : l'athlète le colle.
// Accepte le lien complet, le schéma de l'app ou le jeton seul.
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

export const parseInviteToken = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;
  if (TOKEN.test(raw)) return raw;
  const match = raw.match(/(?:^|[/:])i\/([A-Za-z0-9_-]{16,128})(?:[/?#\s]|$)/);
  return match?.[1] ?? null;
};
