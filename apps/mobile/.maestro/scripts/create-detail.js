// Fixture locale du lot 3 : un bloc commun avec un exercice seul et un groupe de deux exercices, publié demain pour
// un athlète, sans toucher aux séances du jour. Le remplacement en autonomie vise un exercice au nom sans accent.
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
var athleteSpace = json(http.get(base + "/api/v1/me", athleteAuth).body).spaces[0];
var org = athleteSpace.organizationId;
var coachAuth = signIn(COACH_EMAIL);
var exercises = json(http.get(base + "/api/v1/orgs/" + org + "/exercises", coachAuth).body);
var picked = [];
var replacement = null;
for (var i = 0; i < exercises.length; i++) {
  var plain = /^[A-Za-z ]{4,30}$/.test(exercises[i].name);
  if (plain && !replacement && picked.length === 3) replacement = exercises[i];
  else if (picked.length < 3) picked.push(exercises[i]);
}
if (picked.length !== 3 || !replacement) throw new Error("quatre fiches requises pour la recette");
var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
var body = {
  date: tomorrow, startTime: null, location: null,
  assignments: [{ targetType: "athlete", targetId: athleteSpace.athleteId }],
  draft: {
    structureVersion: 2, title: "Constructeur détaillé de recette", type: "strength", durationMin: 30, coachNote: null,
    blocks: [{
      ref: "detail-block", name: "Corps de séance", variant: "both",
      items: [
        { ref: "detail-a", exerciseId: picked[0].id, prescription: { sets: 3, reps: 5, load: { type: "kg", value: 60 } } },
        { ref: "detail-b", exerciseId: picked[1].id, prescription: { sets: 1, reps: 10 } },
        { ref: "detail-c", exerciseId: picked[2].id, prescription: { sets: 1, reps: 12 } },
      ],
      sequence: [
        { kind: "exercise", itemRef: "detail-a" },
        { kind: "repeat", ref: "detail-round", name: "Circuit", rounds: 2, restBetweenRoundsS: 60,
          children: [{ kind: "exercise", itemRef: "detail-b" }, { kind: "exercise", itemRef: "detail-c" }] },
      ],
    }],
  },
};
var saved = http.post(base + "/api/v1/orgs/" + org + "/sessions", { headers: coachAuth.headers, body: JSON.stringify(body) });
if (!saved.ok) throw new Error("création de la séance refusée : " + saved.status);
var session = json(saved.body);
var published = http.post(base + "/api/v1/orgs/" + org + "/sessions/" + session.id + "/publish", {
  headers: coachAuth.headers, body: JSON.stringify({ expectedVersion: session.version }),
});
if (!published.ok) throw new Error("publication refusée : " + published.status);
output.detailBuilderUrl = "tartan-dev:///session-builder/" + session.id;
output.detailId = session.id;
output.detailOrg = org;
output.replacementId = replacement.id;
output.replacementName = replacement.name;
