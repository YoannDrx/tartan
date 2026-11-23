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
// En CI, la séance du jour existe aussi le lendemain (le job peut franchir minuit à Paris) : on les modifie toutes,
// celle que l'athlète a ouverte en fait partie.
var sessions = [];
for (var i = 0; i < grid.sessions.length; i++)
  if (grid.sessions[i].title === "Force et pliométrie") sessions.push(grid.sessions[i]);
if (!sessions.length) throw new Error("séance du jour introuvable");

for (var s = 0; s < sessions.length; s++) {
  var session = sessions[s];
  var edit = json(http.get(base + "/api/v1/orgs/" + org + "/sessions/" + session.id, auth).body);
  var body = {};
  for (var key in edit) if (["id", "version", "publishedAt", "logCount"].indexOf(key) < 0) body[key] = edit[key];
  body.expectedVersion = edit.expectedVersion || edit.version;
  body.draft.coachNote = "Échauffement plus long ce soir";
  // Le contexte de phase gardé par la séance date de la graine. Depuis, un athlète a pu rejoindre le groupe (l'accueil
  // de la CI) : le serveur refuserait ce contexte périmé (409 phase_context_conflict). Le coach relit les phases,
  // comme le fait le constructeur, et renvoie le contexte du jour.
  if (body.phaseReview) {
    var targets = body.assignments || [];
    var planning = http.post(base + "/api/v1/orgs/" + org + "/phases/planning", {
      headers: auth.headers,
      body: JSON.stringify({
        date: body.date,
        groupIds: targets
          .filter(function (a) {
            return a.targetType === "group";
          })
          .map(function (a) {
            return a.targetId;
          }),
        athleteIds: targets
          .filter(function (a) {
            return a.targetType === "athlete";
          })
          .map(function (a) {
            return a.targetId;
          }),
        choices: body.phaseReview.choices || [],
      }),
    });
    if (!planning.ok) throw new Error("relecture des phases refusée : " + planning.status + " " + planning.body);
    body.phaseReview = { token: json(planning.body).token, choices: body.phaseReview.choices || [] };
  }
  var saved = http.put(base + "/api/v1/orgs/" + org + "/sessions/" + session.id, {
    headers: auth.headers,
    body: JSON.stringify(body),
  });
  if (!saved.ok) throw new Error("modification refusée : " + saved.status + " " + saved.body);
}
output.bumped = "oui";
