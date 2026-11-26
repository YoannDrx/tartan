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
var auth = signIn(ATHLETE2_EMAIL);
function cards(org) {
  return json(http.get(base + "/api/v1/orgs/" + org + "/athlete/today", auth).body).today;
}
var personal = cards(output.notebookOrg).filter(function (s) {
  return output.beforeIds.indexOf(s.id) < 0;
});
if (personal.length !== 1) throw new Error("La proposition doit créer une seule séance personnelle aujourd’hui");
output.personalId = personal[0].id;
var club = cards(output.clubOrg);
if (
  club.some(function (s) {
    return s.id === output.personalId;
  })
)
  throw new Error("La séance personnelle apparaît dans le club");
if (typeof VERIFY_LOGS !== "undefined" && VERIFY_LOGS === "yes") {
  if (
    personal[0].status !== "done" ||
    !club.some(function (s) {
      return s.id === output.clubId && s.status === "done";
    })
  )
    throw new Error("Les deux validations doivent être enregistrées dans leurs carnets");
}
