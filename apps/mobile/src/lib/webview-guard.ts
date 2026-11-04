// Un lecteur vidéo reste un lecteur : on n'y navigue pas dans YouTube ou Instagram depuis Tartan.
// Les cadres internes du lecteur chargent librement, seule la page principale est tenue.
export const staysInPlayer = (
  request: { url: string; isTopFrame?: boolean },
  initialUrl: string | null,
): boolean => {
  if (request.url.startsWith("about:")) return true;
  if (request.isTopFrame === false) return request.url.startsWith("https://");
  return initialUrl !== null && request.url === initialUrl;
};
