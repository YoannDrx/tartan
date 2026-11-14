// Fixture locale : une séance future distincte laisse les scénarios du jour inchangés.
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
var athleteAuth = signIn(ATHLETE_EMAIL);
var athleteMe = json(http.get(base + "/api/v1/me", athleteAuth).body);
var athleteSpace = athleteMe.spaces[0];
var org = athleteSpace.organizationId;
var coachAuth = signIn(COACH_EMAIL);
var exercises = json(http.get(base + "/api/v1/orgs/" + org + "/exercises", coachAuth).body);
var guided = [];
for (var i = 0; i < exercises.length && guided.length < 2; i++) {
  if (exercises[i].guide) guided.push(exercises[i]);
}
if (guided.length !== 2) throw new Error("deux guides requis pour la recette");
var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
var body = {
  date: tomorrow, startTime: null, location: null,
  assignments: [{ targetType: "athlete", targetId: athleteSpace.athleteId }],
  draft: {
    structureVersion: 2, title: "Circuit natif de recette", type: "strength", durationMin: 20, coachNote: null,
    blocks: [{
      ref: "native-block", name: "Circuit", variant: "both",
      items: [
        { ref: "native-a", exerciseId: guided[0].id, prescription: { sets: 1, reps: 5 } },
        { ref: "native-b", exerciseId: guided[1].id, prescription: { sets: 1, reps: 8 } },
      ],
      sequence: [{ kind: "repeat", ref: "native-round", name: "Circuit", rounds: 2, restBetweenRoundsS: 60,
        children: [
          { kind: "exercise", itemRef: "native-a" },
          { kind: "recovery", ref: "native-rest", durationS: 15 },
          { kind: "exercise", itemRef: "native-b" },
        ],
      }],
    }],
  },
};
var saved = http.post(base + "/api/v1/orgs/" + org + "/sessions", { headers: coachAuth.headers, body: JSON.stringify(body) });
if (!saved.ok) throw new Error("création du circuit refusée : " + saved.status);
var session = json(saved.body);
var published = http.post(base + "/api/v1/orgs/" + org + "/sessions/" + session.id + "/publish", {
  headers: coachAuth.headers, body: JSON.stringify({ expectedVersion: session.version }),
});
if (!published.ok) throw new Error("publication du circuit refusée : " + published.status);
output.circuitUrl = "tartan-dev:///session/" + session.id;

output.circuitBuilderUrl = "tartan-dev:///session-builder/" + session.id;
output.circuitId = session.id;
output.circuitOrg = org;
