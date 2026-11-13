/** Conserve la vérification du certificat et du nom d'hôte lors du changement de sémantique de pg. */
export const postgresConnectionString = (value: string | undefined): string | undefined => {
  if (!value) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // L'adaptateur reste responsable des formats non URL et des erreurs, sans journaliser le secret.
    return value;
  }
  const mode = url.searchParams.get("sslmode");
  if (url.searchParams.get("uselibpqcompat") !== "true" && mode && ["prefer", "require", "verify-ca"].includes(mode)) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return value;
};
