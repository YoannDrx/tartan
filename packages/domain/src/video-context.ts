/** Legacy jump metadata remains meaningful; a shared session's bar sheet alone does not classify a video. */
export const hasHighJumpContext = (video: {
  barHeightCm?: number | null;
  attemptNo?: number | null;
  result?: string | null;
  annotations?: readonly { phase?: string | null }[];
}): boolean =>
  video.barHeightCm != null ||
  video.attemptNo != null ||
  video.result != null ||
  Boolean(video.annotations?.some((annotation) => annotation.phase != null));

export const HIGH_JUMP_DISCIPLINE = "high_jump";

/**
 * La feuille de barres ne sert qu'au saut en hauteur : elle n'est proposée que si les athlètes affichés en font
 * (audit G2). Un athlète sans épreuve renseignée suit celles de l'espace. Les filtres athlète et groupe restreignent
 * le périmètre ; un périmètre vide ne propose rien.
 */
export const barSheetInScope = (input: {
  spaceDisciplines: readonly string[];
  athletes: readonly { id: string; disciplines: readonly string[]; groupIds: readonly string[] }[];
  athleteId?: string;
  groupId?: string;
}): boolean =>
  input.athletes
    .filter(
      (a) => (!input.athleteId || a.id === input.athleteId) && (!input.groupId || a.groupIds.includes(input.groupId)),
    )
    .some((a) => (a.disciplines.length ? a.disciplines : input.spaceDisciplines).includes(HIGH_JUMP_DISCIPLINE));
