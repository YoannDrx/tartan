// La séance isolée est créée par create-circuit.js. Un vrai WAV synthétique permet de tester le lecteur natif.
var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("fixture réservée au serveur local");
function sessionCookie(email) {
  var auth = http.post(base + "/api/auth/sign-in/email", {
    headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({email:email,password:PASSWORD})
  });
  var cookie = String(auth.headers["set-cookie"] || auth.headers["Set-Cookie"] || "").match(/better-auth\.session_token=[^;,\]\s]+/);
  if (!cookie) throw new Error("connexion de recette impossible");
  return cookie[0];
}
var athleteCookie = sessionCookie(ATHLETE_EMAIL);
var athlete = json(http.get(base + "/api/v1/me", {headers:{Cookie:athleteCookie}}).body).spaces[0];
var route = base + "/api/v1/orgs/" + output.circuitOrg + "/sessions/" + output.circuitId;
var detail = json(http.get(route + "/me", {headers:{Cookie:athleteCookie}}).body);
var coachRoute = route + "/thread?athleteId=" + encodeURIComponent(athlete.athleteId) + "&itemRef=" + encodeURIComponent(detail.blocks[0].items[0].ref);
var coachCookie = sessionCookie(COACH_EMAIL);
function little(value, width) {
  var result = "";
  for (var n = 0; n < width; n++) { result += String.fromCharCode(value & 255); value = value >>> 8; }
  return result;
}
var length = 65536;
var wav = "RIFF" + little(length + 36, 4) + "WAVEfmt " + little(16,4) + little(1,2) + little(1,2) +
  little(8192,4) + little(16384,4) + little(2,2) + little(16,2) + "data" + little(length,4) + Array(length + 1).join("\x00");
var id = "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function () { return Math.floor(Math.random()*16).toString(16); });
var reply = http.post(coachRoute, { headers: {Cookie:coachCookie, Origin:base, "Content-Type":"audio/wav","Idempotency-Key":id}, body:wav });
if (!reply.ok) throw new Error("vocal de recette refusé : " + reply.status);
output.threadCoachUrl = "tartan-dev:///coach-session/" + output.circuitId;
output.threadExercise = detail.blocks[0].items[0].name + " · " + "Circuit · tour 1 sur 2";
