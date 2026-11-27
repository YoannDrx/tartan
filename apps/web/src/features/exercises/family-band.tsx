import type { ExerciseFamily } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { FamilyPicto } from "@/components/pictos";
import { familyColors } from "@/lib/activity-colors";

/** Les lignes affichées, regroupées par famille dans leur ordre, chacune avec son rang dans toute la liste. */
export const familySections = <R extends { family: ExerciseFamily }>(rows: readonly R[]) => {
  const sections: { family: ExerciseFamily; rows: { row: R; index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const last = sections.at(-1);
    if (last?.family === row.family) last.rows.push({ row, index });
    else sections.push({ family: row.family, rows: [{ row, index }] });
  });
  return sections;
};

/**
 * Le bandeau d'une famille : sa teinte, son pictogramme, son nom et son nombre de fiches. Il reste collé sous
 * l'en-tête pendant que sa section défile, puis la famille suivante le pousse. Le nom et le pictogramme portent le
 * sens ; la couleur aide seulement à voir où une section commence.
 */
export const FamilyBand = ({ id, family, count }: { id: string; family: ExerciseFamily; count: number }) => {
  const tint = familyColors(family);
  return (
    <h2
      id={id}
      data-family={family}
      className="t-section sticky top-[calc(var(--offline-bar-height,0px)+var(--app-header-height,58px))] z-10 flex min-h-11 items-center gap-2.5 px-4 py-2"
      style={{ backgroundColor: tint.background, color: tint.text }}
    >
      <FamilyPicto family={family} className="size-5" />
      <span className="min-w-0 flex-1 break-words">{m.exerciseGuide.families[family]}</span>{" "}
      <span className="t-caption shrink-0 font-semibold tabular-nums">{m.exerciseGuide.familyCount(count)}</span>
    </h2>
  );
};
