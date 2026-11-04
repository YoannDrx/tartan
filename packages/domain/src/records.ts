export type RecordMark = { id: string; mark: number; unit: string };

const CM_PER_M = 100;

// 205 cm et 2,10 m se comparent en mètres. Un temps ne se compare qu'à un temps.
export const toComparableMark = (mark: number, unit: string): number => (unit === "cm" ? mark / CM_PER_M : mark);

export const personalBestIds = (marks: readonly RecordMark[]): string[] => {
  const times = marks.filter((row) => row.unit === "s");
  const lengths = marks.filter((row) => row.unit !== "s");
  const best: string[] = [];
  if (times.length > 0) {
    const fastest = Math.min(...times.map((row) => row.mark));
    best.push(times.find((row) => row.mark === fastest)!.id);
  }
  if (lengths.length > 0) {
    const longest = Math.max(...lengths.map((row) => toComparableMark(row.mark, row.unit)));
    best.push(lengths.find((row) => toComparableMark(row.mark, row.unit) === longest)!.id);
  }
  return best;
};
