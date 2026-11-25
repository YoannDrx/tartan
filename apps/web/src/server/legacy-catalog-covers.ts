// Les identifiants des fiches communes précèdent le catalogue à clés. Chaque couverture reste soumise à sa propre relecture.
type LegacyCover = { id: string; key: string; imageVersion: number; alt: string };
const covers: LegacyCover[] = [
  {
    id: "ca339bcd-e7ec-5dd7-9171-6bedadadf854",
    key: "legacy-knee-series",
    imageVersion: 1,
    alt: "Au bord du tapis, l’athlète ajuste ses lacets avant la routine.",
  },
  {
    id: "a4e8c41e-6023-568b-8ed4-6fa54f0d5d9e",
    key: "legacy-hip-five",
    imageVersion: 1,
    alt: "L’un des cinq mouvements de la routine. L’athlète fléchit les jambes en position du cavalier, pieds écartés.",
  },
  {
    id: "73d21489-90b7-5650-b569-f5efbd21a39b",
    key: "legacy-kb-airplane",
    imageVersion: 1,
    alt: "En équilibre sur un pied, le buste s’incline, la jambe libre s’allonge et une kettlebell pend sous l’épaule.",
  },
  {
    id: "03a42923-d51f-55a6-86c9-27995abb840f",
    key: "legacy-kb-9090",
    imageVersion: 1,
    alt: "Assise avec les genoux pliés de part et d’autre, l’athlète tient la kettlebell devant la poitrine.",
  },
  {
    id: "b0231454-0121-52bc-a978-bcbe32c7508d",
    key: "legacy-lunge-mobility",
    imageVersion: 1,
    alt: "En fente basse sur un tapis, le genou arrière est au sol et le pied avant à plat.",
  },
  {
    id: "81c7796f-50db-501d-b0bc-786ebc714766",
    key: "legacy-box-hip-floor",
    imageVersion: 1,
    alt: "Allongée sur le dos, l’athlète pose un pied sur le caisson bas et l’autre sur le sol.",
  },
  {
    id: "298623a3-0017-5197-8eac-2cc82852e83e",
    key: "legacy-dumbbell-side-lunge",
    imageVersion: 1,
    alt: "La hanche descend au-dessus du genou fléchi, l’autre jambe reste tendue et l’haltère entre les deux pieds.",
  },
  {
    id: "f8e90e55-0385-56fb-bfb4-065f61ad5351",
    key: "legacy-plate-half-kneeling",
    imageVersion: 1,
    alt: "En demi-agenouillé, l’athlète tient un disque à deux mains au-dessus de la tête.",
  },
  {
    id: "dd44140e-42e5-50fb-a436-1d8b5953b164",
    key: "legacy-hamstring-floss",
    imageVersion: 1,
    alt: "En appui sur le genou arrière, l’athlète tend la jambe avant, talon au sol et pointe relevée.",
  },
  {
    id: "da77c82f-8403-5e39-9715-fceb16a8f8d0",
    key: "legacy-kb-hip-march",
    imageVersion: 1,
    alt: "En équilibre sur une jambe, l’athlète monte le genou opposé. Une petite kettlebell pend au pied levé.",
  },
  {
    id: "e803f572-0db8-55a8-b734-a8cadc7e96b0",
    key: "legacy-mobility-session",
    imageVersion: 1,
    alt: "L’athlète déroule son tapis au bord de la piste avant la séance de mobilité.",
  },
  {
    id: "b4857e08-036d-502a-90d8-202375e78a56",
    key: "legacy-kb-ankle",
    imageVersion: 1,
    alt: "Un genou au sol, l’athlète soutient une kettlebell sur le genou avant, talon posé.",
  },
  {
    id: "37640c34-7753-5a65-bdc4-2025b086d945",
    key: "legacy-hip-levels",
    imageVersion: 1,
    alt: "Assise sur le tapis, genoux fléchis et mains en appui, l’athlète prépare la routine de hanche.",
  },
  {
    id: "5187b0a5-ff48-5254-9f43-fcc485192a5d",
    key: "legacy-front-rack-mobility",
    imageVersion: 1,
    alt: "La barre à vide repose devant les épaules, coudes relevés.",
  },
  {
    id: "945c7837-c684-57f0-9b94-82f89da9f0e0",
    key: "legacy-split-box-plyo",
    imageVersion: 1,
    alt: "Le pied avant repose sur un caisson bas et le pied arrière reste au sol en fente.",
  },
  {
    id: "a0ae423b-c58f-5396-b603-95ee3645e4fe",
    key: "legacy-seated-leg-lifts",
    imageVersion: 1,
    alt: "Assise jambes longues, mains près des hanches, l’athlète décolle un talon.",
  },
  {
    id: "ae58b090-002c-542c-afe2-8a65289e0d56",
    key: "legacy-one-leg-hip",
    imageVersion: 1,
    alt: "Une main au support, l’athlète tient sur une jambe et écarte l’autre sur le côté.",
  },
  {
    id: "0f79980d-006c-51f2-8c1b-d5465b2d874f",
    key: "legacy-seated-hip",
    imageVersion: 1,
    alt: "Assise jambes tendues et pieds relevés, l’athlète prend appui sur les mains.",
  },
  {
    id: "e25735c2-4174-5398-9d25-c67bf39623b3",
    key: "tibialis-raise",
    imageVersion: 1,
    alt: "Adossée au mur, l’athlète relève les pointes des pieds en gardant les talons au sol.",
  },
  {
    id: "048c9334-a46e-531c-8678-573a717ce427",
    key: "single-leg-rdl",
    imageVersion: 1,
    alt: "Sur un pied, l’athlète incline le buste, un haltère en main, l’autre jambe tendue derrière.",
  },
  {
    id: "0ab4cf50-ea36-510c-b976-54adfea7a2e8",
    key: "legacy-kb-cossack",
    imageVersion: 1,
    alt: "En squat cosaque, l’athlète tient une kettlebell devant la poitrine, une jambe tendue sur le côté.",
  },
  {
    id: "ac829309-1df4-5126-af17-099ba6ee5476",
    key: "clean-and-jerk",
    imageVersion: 1,
    alt: "Après l’épaulé, l’athlète reçoit le jeté en fente, la barre au-dessus de la tête.",
  },
  {
    id: "0de5f2e9-301c-5188-bc99-cba99cc1864e",
    key: "legacy-high-clean-pull",
    imageVersion: 1,
    alt: "Le corps redressé, l’athlète tire la barre près du buste, coudes hauts et écartés.",
  },
  {
    id: "c053f0da-6df2-55af-87be-c6c4ce30ecd2",
    key: "legacy-stick-snatch",
    imageVersion: 1,
    alt: "En réception basse, l’athlète tient un manche en bois au-dessus de la tête en prise large.",
  },
];
export const legacyCovers = new Map(
  covers.map((cover) => [cover.id, { ...cover, path: `/exercise-photos/${cover.key}-v${cover.imageVersion}.webp` }]),
);
export const legacyCoverStamp = (cover: LegacyCover) =>
  `exerciseReview:legacy:${cover.id}:${cover.key}:image:v${cover.imageVersion}`;
