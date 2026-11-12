import { hurdles } from "./hurdles";
import { longJump } from "./long-jump";

// Registre des épreuves, pour qui doit en retrouver une par son identifiant (le serveur, à la relecture).
export const EVENTS = { hurdles, longJump } as const;
export type EventId = keyof typeof EVENTS;

export const isEventId = (id: unknown): id is EventId => typeof id === "string" && Object.hasOwn(EVENTS, id);
