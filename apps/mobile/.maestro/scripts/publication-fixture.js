// Fixture locale du message de publication (constat G10) : un brouillon pour demain, destiné à un seul athlète qui a un
// compte. Publié depuis le constructeur natif, il doit dire « 1 athlète reçoit la notification ».
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
var athleteSpace = json(http.get(base + "/api/v1/me", signIn(ATHLETE_EMAIL)).body).spaces[0];
var org = athleteSpace.organizationId;
var coachAuth = signIn(COACH_EMAIL);
var exercises = json(http.get(base + "/api/v1/orgs/" + org + "/exercises", coachAuth).body);
if (!exercises.length) throw new Error("une fiche requise pour la recette");
var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
var body = {
  date: tomorrow,
  startTime: null,
  location: null,
  assignments: [{ targetType: "athlete", targetId: athleteSpace.athleteId }],
  draft: {
    structureVersion: 2,
    title: "Publication native de recette",
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
output.publicationUrl = "tartan-dev:///session-builder/" + json(saved.body).id;
