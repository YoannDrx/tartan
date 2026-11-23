// Fixture locale de l'analyse en plein écran : la première vidéo lisible de l'espace du coach. Le serveur de recette
// doit la servir (`next dev` avec `VIDEO_DEV_MP4_URL`, ou Mux réel) : sans vidéo lisible, le parcours s'arrête net.
var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("fixture réservée au serveur local");
var login = http.post(base + "/api/auth/sign-in/email", {
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: COACH_EMAIL, password: PASSWORD }),
});
var cookie = String(login.headers["set-cookie"] || login.headers["Set-Cookie"] || "").match(
  /better-auth\.session_token=[^;,\]\s]+/,
);
if (!cookie) throw new Error("connexion de recette refusée : " + login.status);
var auth = { headers: { Cookie: cookie[0] } };
var org = json(http.get(base + "/api/v1/me", auth).body).spaces[0].organizationId;
var page = json(http.get(base + "/api/v1/orgs/" + org + "/videos?page=1&status=ready", auth).body);
var found = null;
for (var i = 0; i < page.videos.length && !found; i++) {
  var detail = json(http.get(base + "/api/v1/orgs/" + org + "/videos/" + page.videos[i].id, auth).body);
  if ((detail.mp4Url || detail.hlsUrl) && detail.canAnnotate) found = detail;
}
if (!found) throw new Error("aucune vidéo lisible et annotable : lancer le serveur avec VIDEO_DEV_MP4_URL");
output.videoUrl = "tartan-dev:///video/" + found.id;
