// Fabrique un conflit de synchronisation : pendant que la séance du jour est ouverte chez l'athlète, le coach
// la réenregistre, ce qui change sa version. La saisie de l'athlète, faite sur l'ancienne version, sera refusée.
var base = API_URL;
var login = http.post(base + "/api/auth/sign-in/email", {
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: COACH_EMAIL, password: PASSWORD }),
});
var raw = String(login.headers["set-cookie"] || login.headers["Set-Cookie"] || "");
var match = raw.match(/better-auth\.session_token=[^;,\]\s]+/);
if (!match) throw new Error("connexion du coach impossible : " + login.status);
var auth = { headers: { Cookie: match[0], "Content-Type": "application/json", Origin: base } };

var me = json(http.get(base + "/api/v1/me", auth).body);
var org = me.spaces[0].organizationId;
var grid = json(http.get(base + "/api/v1/orgs/" + org + "/tracking", auth).body);
var session = null;
for (var i = 0; i < grid.sessions.length; i++) if (grid.sessions[i].title === "Force et pliométrie") session = grid.sessions[i];
if (!session) throw new Error("séance du jour introuvable");

var edit = json(http.get(base + "/api/v1/orgs/" + org + "/sessions/" + session.id, auth).body);
var body = {};
for (var key in edit) if (["id", "version", "publishedAt", "logCount"].indexOf(key) < 0) body[key] = edit[key];
body.expectedVersion = edit.expectedVersion || edit.version;
body.draft.coachNote = "Échauffement plus long ce soir";
var saved = http.put(base + "/api/v1/orgs/" + org + "/sessions/" + session.id, {
  headers: auth.headers,
  body: JSON.stringify(body),
});
if (!saved.ok) throw new Error("modification refusée : " + saved.status + " " + saved.body);
output.bumped = "oui";
