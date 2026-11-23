// Le partage de l'historique personnel d'un athlète autonome avec l'espace d'un coach : par cases, révocable,
// en lecture seule. La santé n'est pas une case : elle ne se partage jamais par ce chemin.

export type HistoryScope = "records" | "strength" | "sessions";

export const HISTORY_SCOPES: readonly HistoryScope[] = ["records", "strength", "sessions"];

// Les cases cochées, sans doublon, dans l'ordre de l'écran ; tout ce qui n'est pas une case connue est ignoré.
export const normalizeHistoryScopes = (scopes: readonly string[]): HistoryScope[] =>
  HISTORY_SCOPES.filter((scope) => scopes.includes(scope));

// Ce qu'un coach peut lire, à l'instant : rien d'un partage retiré ou vide.
export const readableHistoryScopes = (
  share: { scopes: readonly string[]; revokedAt: Date | string | null } | null,
): HistoryScope[] => (share && !share.revokedAt ? normalizeHistoryScopes(share.scopes) : []);

// Le coach est prévenu quand le partage s'ouvre ou s'élargit, pas quand l'athlète retire une case.
export const historyShareWidens = (before: readonly HistoryScope[], after: readonly HistoryScope[]): boolean =>
  after.some((scope) => !before.includes(scope));
