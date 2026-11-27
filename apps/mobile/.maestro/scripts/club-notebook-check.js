// Après le flux `athlete-club-notebook` : le carnet est ouvert sur l'offre personnelle, sa séance existe, et le coach
// du club ne la voit ni dans son suivi ni dans son planning.
var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("contrôle réservé au serveur local");
function signIn(email) {
  var response = http.post(base + "/api/auth/sign-in/email", {
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: email, password: PASSWORD }),
  });
  var raw = String(response.headers["set-cookie"] || response.headers["Set-Cookie"] || "");
  var match = raw.match(/better-auth\.session_token=[^;,\]\s]+/);
  if (!match) throw new Error("connexion de recette impossible : " + response.status);
  return { headers: { Cookie: match[0], "Content-Type": "application/json", Origin: base } };
}
var athlete = signIn(NEWCOMER_EMAIL);
var spaces = json(http.get(base + "/api/v1/me", athlete).body).spaces;
var notebook = spaces.filter(function (s) {
  return s.kind === "personal";
})[0];
var club = spaces.filter(function (s) {
  return s.role === "athlete" && s.kind !== "personal";
})[0];
if (!notebook || !club) throw new Error("Le carnet et le club doivent figurer tous deux dans les espaces");
var from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
var to = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
var mine = json(
  http.get(base + "/api/v1/orgs/" + notebook.organizationId + "/calendar?from=" + from + "&to=" + to, athlete).body,
);
var ids = (mine.sessions || mine).map(function (s) {
  return s.id;
});
if (ids.length < 1) throw new Error("La proposition doit créer une séance dans le carnet");
var coach = signIn(COACH_EMAIL);
var tracking = http.get(base + "/api/v1/orgs/" + club.organizationId + "/tracking", coach).body;
var planning = http.get(
  base + "/api/v1/orgs/" + club.organizationId + "/calendar?from=" + from + "&to=" + to,
  coach,
).body;
ids.forEach(function (id) {
  if (tracking.indexOf(id) >= 0 || planning.indexOf(id) >= 0) throw new Error("Le coach voit une séance du carnet");
});
var blocked = http.get(base + "/api/v1/orgs/" + notebook.organizationId + "/athlete/today", coach);
if (blocked.status !== 403) throw new Error("Le coach ne doit pas lire le carnet : " + blocked.status);
