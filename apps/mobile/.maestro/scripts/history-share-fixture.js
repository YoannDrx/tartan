// Fixture locale du partage de l'historique (lot AA3) : le lien du premier groupe du coach de démonstration, ouvert
// dans l'app. Le compte qui l'ouvre (`SHARER_EMAIL`) a déjà son espace personnel, créé par la CI.
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
var auth = { headers: { Cookie: cookie[0], "Content-Type": "application/json", Origin: base } };
var me = json(http.get(base + "/api/v1/me", auth).body);
var owned = me.spaces.filter(function (space) {
  return space.role === "owner";
})[0];
if (!owned) throw new Error("espace du coach de démonstration requis");
var groups = json(http.get(base + "/api/v1/orgs/" + owned.organizationId + "/groups", auth).body);
if (!groups.length) throw new Error("un groupe requis pour la recette");
var link = http.post(base + "/api/v1/orgs/" + owned.organizationId + "/groups/" + groups[0].id + "/link", auth);
if (!link.ok) throw new Error("lien du groupe refusé : " + link.status);
var token = json(link.body).link.split("/i/")[1];
output.organizationId = owned.organizationId;
output.organizationName = owned.organizationName;
output.inviteUrl = "tartan-dev:///i/" + token;
