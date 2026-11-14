var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("fixture réservée au serveur local");
var login = http.post(base + "/api/auth/sign-in/email", {
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: COACH_EMAIL, password: PASSWORD }),
});
var raw = String(login.headers["set-cookie"] || login.headers["Set-Cookie"] || "");
var cookie = raw.match(/better-auth\.session_token=[^;,\]\s]+/);
if (!cookie) throw new Error("connexion de recette refusée");
var response = http.get(base + "/api/v1/orgs/" + output.circuitOrg + "/sessions/" + output.circuitId, { headers: { Cookie: cookie[0] } });
if (!response.ok) throw new Error("lecture du circuit refusée");
var draft = json(response.body).draft;
if (draft.structureVersion !== 2 || draft.blocks.length !== 1) throw new Error("structure du circuit perdue");
var block = draft.blocks[0];
var group = block.sequence[0];
if (group.kind !== "repeat" || group.rounds !== 3 || group.restBetweenRoundsS !== 60) throw new Error("tours ou pause altérés");
var children = group.children;
if (typeof EXPECT_NESTED !== "undefined" && EXPECT_NESTED === "true") {
  if (children.length !== 1 || children[0].kind !== "repeat" || children[0].rounds !== 3 || children[0].restBetweenRoundsS !== 0) throw new Error("groupe imbriqué perdu");
  children = children[0].children;
}
if (children.length !== 3 || children[0].itemRef !== "native-a" || children[1].durationS !== 15 || children[2].itemRef !== "native-b") throw new Error("ordre ou identifiants altérés");
if (block.items.length !== 2 || block.items[0].prescription.reps !== 5 || block.items[1].prescription.reps !== 8) throw new Error("prescription altérée");
