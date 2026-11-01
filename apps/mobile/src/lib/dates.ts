const pad = (n: number) => String(n).padStart(2, "0");

// Date civile du téléphone, pas la date UTC : à 23 h 30 on est encore aujourd'hui.
export const localIsoDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const dayNumber = (isoDate: string): string => String(Number(isoDate.slice(8, 10)));
