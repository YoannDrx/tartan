var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("fixture réservée au serveur local");
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
var athleteAuth = signIn(ATHLETE2_EMAIL);
var spaces = json(http.get(base + "/api/v1/me", athleteAuth).body).spaces;
var club = spaces.filter(function (s) {
  return s.role === "athlete" && s.kind !== "personal";
})[0];
var notebook = http.post(base + "/api/v1/me/personal-space", {
  headers: athleteAuth.headers,
  body: JSON.stringify({ firstName: "Camille", lastName: "Recette", termsAccepted: true }),
});
if (!notebook.ok) throw new Error("carnet personnel indisponible : " + notebook.status);
output.notebookOrg = json(notebook.body).organizationId;
var org = club.organizationId;
var coachAuth = signIn(COACH_EMAIL);
var exercises = json(http.get(base + "/api/v1/orgs/" + org + "/exercises", coachAuth).body);
var day = json(http.get(base + "/api/v1/orgs/" + org + "/athlete/today", athleteAuth).body);
var date = day.today.length ? day.today[0].date : new Date().toISOString().slice(0, 10);
var body = {
  date: date,
  startTime: null,
  location: null,
  assignments: [{ targetType: "athlete", targetId: club.athleteId }],
  draft: {
    structureVersion: 2,
    title: "Séance du club pour le carnet",
    type: "strength",
    durationMin: 20,
    coachNote: null,
    blocks: [
      {
        ref: "publication-block",
        name: "Corps de séance",
        variant: "club",
        items: [{ ref: "publication-a", exerciseId: exercises[0].id, prescription: { sets: 3, reps: 5 } }],
        sequence: [{ kind: "exercise", itemRef: "publication-a" }],
      },
    ],
  },
};
var saved = http.post(base + "/api/v1/orgs/" + org + "/sessions", {
  headers: coachAuth.headers,
  body: JSON.stringify(body),
});
if (!saved.ok) throw new Error("création du brouillon refusée : " + saved.status);
var session = json(saved.body);
var published = http.post(base + "/api/v1/orgs/" + org + "/sessions/" + session.id + "/publish", {
  headers: coachAuth.headers,
  body: JSON.stringify({ expectedVersion: session.version }),
});
if (!published.ok) throw new Error("publication du club refusée : " + published.status);
output.clubId = session.id;
output.clubOrg = org;
output.beforeIds = json(
  http.get(base + "/api/v1/orgs/" + output.notebookOrg + "/athlete/today", athleteAuth).body,
).today.map(function (s) {
  return s.id;
});
