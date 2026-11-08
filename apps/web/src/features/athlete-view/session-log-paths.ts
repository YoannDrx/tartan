export const sessionLogPaths = (orgId: string, sessionId: string, athleteId?: string) => {
  const base = `/orgs/${encodeURIComponent(orgId)}/sessions/${encodeURIComponent(sessionId)}`;
  return {
    write: athleteId ? `${base}/athletes/${encodeURIComponent(athleteId)}/log` : `${base}/log`,
    read: athleteId ? `${base}/athletes/${encodeURIComponent(athleteId)}/log` : `${base}/me`,
  };
};
