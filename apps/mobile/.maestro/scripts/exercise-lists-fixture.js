// Fixture locale des listes du coach (parité mobile, lot M2) : la fiche « Squat arrière » sans étoile au départ, et
// des noms neufs à chaque passage, pour que le parcours se rejoue. Variable FAVORITE : « on » met l'étoile d'avance.
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
var org = me.spaces[0].organizationId;
var exercises = json(http.get(base + "/api/v1/orgs/" + org + "/exercises", auth).body);
var squat = exercises.filter(function (exercise) {
  return exercise.name.indexOf("Squat arrière") === 0;
})[0];
if (!squat) throw new Error("fiche « Squat arrière » requise pour la recette");
var favorite = typeof FAVORITE !== "undefined" && FAVORITE === "on";
var star = http.put(base + "/api/v1/orgs/" + org + "/exercises/" + squat.id + "/favorite", {
  headers: auth.headers,
  body: JSON.stringify({ favorite: favorite }),
});
if (!star.ok) throw new Error("étoile de départ refusée : " + star.status);
var stamp = String(Date.now()).slice(-6);
output.squatId = squat.id;
output.listName = "Liste native " + stamp;
output.exerciseName = "Gainage natif " + stamp;
if (favorite) {
  // Le sélecteur du constructeur range la fiche dans une liste déjà créée.
  var created = http.post(base + "/api/v1/orgs/" + org + "/exercise-lists", {
    headers: auth.headers,
    body: JSON.stringify({ name: output.listName }),
  });
  if (!created.ok) throw new Error("création de la liste refusée : " + created.status);
  output.listId = json(created.body).id;
  output.builderUrl = "tartan-dev:///session-builder/new";
}
