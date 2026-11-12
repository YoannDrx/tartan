import { hurdles } from "./hurdles";
import { longJump } from "./long-jump";
import { tripleJump } from "./triple-jump";
import { highJump } from "./high-jump";

// Registre des épreuves, pour qui doit en retrouver une par son identifiant (le serveur, à la relecture).
export const EVENTS = { hurdles, longJump, tripleJump, highJump } as const;
export type EventId = keyof typeof EVENTS;

export const isEventId = (id: unknown): id is EventId => typeof id === "string" && Object.hasOwn(EVENTS, id);
