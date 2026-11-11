import { hurdles } from "./hurdles";

// Registre des épreuves, pour qui doit en retrouver une par son identifiant (le serveur, à la relecture).
export const EVENTS = { hurdles } as const;
export type EventId = keyof typeof EVENTS;

export const isEventId = (id: unknown): id is EventId => typeof id === "string" && Object.hasOwn(EVENTS, id);
