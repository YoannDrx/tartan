// Le groupe : six athlètes, un par épreuve. Ici, ce qui tient au corps : le dossard et la coiffure.
// Les prénoms sont dans @tartan/i18n, les teints et les tenues dans @tartan/design-tokens.
import { EVENT_IDS, type EventId } from "./event";
import { rig, type Face, type Hair } from "./rig";

// Le dossard reprend le numéro de couloir : l'ordre des épreuves dans DESIGN.md.
export const ATHLETES = {
  hurdles: { bib: 1, hair: "ponytail" },
  poleVault: { bib: 2, hair: "afro" },
  tripleJump: { bib: 3, hair: "bun" },
  discus: { bib: 4, hair: "crop" },
  longJump: { bib: 5, hair: "ponytail" },
  highJump: { bib: 6, hair: "crop" },
} as const satisfies Record<EventId, { bib: number; hair: Hair }>;

export const ATHLETE_IDS = EVENT_IDS;
export type AthleteId = EventId;

// Les os d'un athlète, pour le visage demandé.
export const athleteRig = (id: AthleteId, face: Face = "neutral") => rig({ ...ATHLETES[id], face });
