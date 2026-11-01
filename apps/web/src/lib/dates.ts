export const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const fromDbDate = (d: Date): string => d.toISOString().slice(0, 10);
export const fromDbDateOrNull = (d: Date | null | undefined): string | null => (d ? fromDbDate(d) : null);

const parisDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" });
const parisHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "numeric", hour12: false });

// Le groupe pilote est en France : « aujourd'hui » suit le fuseau de Paris.
export const todayIso = (now: Date = new Date()): string => parisDate.format(now);
export const hourInParis = (now: Date = new Date()): number => Number(parisHour.format(now)) % 24;
