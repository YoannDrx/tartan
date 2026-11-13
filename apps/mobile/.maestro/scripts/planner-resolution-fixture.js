// Comptes synthétiques et prestataire factice, uniquement sur le serveur local.
var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("fixture réservée au serveur local");
var login = http.post(base + "/api/auth/sign-in/email", {
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: COACH_EMAIL, password: PASSWORD }),
});
var cookie = String(login.headers["set-cookie"] || login.headers["Set-Cookie"] || "").match(/better-auth\.session_token=[^;,\]\s]+/);
if (!cookie) throw new Error("connexion de recette refusée");
var auth = { headers: { Cookie: cookie[0] } };
var me = json(http.get(base + "/api/v1/me", auth).body);
var org = me.spaces[0].organizationId;
var context = json(http.get(base + "/api/v1/orgs/" + org + "/session-builder", auth).body);
if (!context.groups.length) throw new Error("groupe de recette requis");
output.plannerMovement = "Mouvement natif de recette " + Date.now();
output.plannerInstruction = output.plannerMovement + ", trois series de huit, repos 90 secondes";
output.plannerUrl = "tartan-dev:///planner?groupId=" + context.groups[0].id;
