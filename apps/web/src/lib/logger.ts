// Journaux structurés : nom d'événement, durée, statut, code d'erreur.
// Jamais de donnée de santé ni de donnée personnelle (§ 14).
type Fields = {
  durationMs?: number;
  status?: string;
  code?: string;
  count?: number;
  organizationId?: string;
  entityId?: string;
};

const write = (level: "info" | "warn" | "error", event: string, fields: Fields = {}) => {
  if (process.env.NODE_ENV === "test") return;
  console[level](JSON.stringify({ level, event, at: new Date().toISOString(), ...fields }));
};

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
