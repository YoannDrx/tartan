// Ce que le constructeur mobile a enregistré : le détail série par série, la sortie du groupe, le remplacement.
var base = API_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("fixture réservée au serveur local");
var login = http.post(base + "/api/auth/sign-in/email", {
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: COACH_EMAIL, password: PASSWORD }),
});
var raw = String(login.headers["set-cookie"] || login.headers["Set-Cookie"] || "");
var cookie = raw.match(/better-auth\.session_token=[^;,\]\s]+/);
if (!cookie) throw new Error("connexion de recette refusée");
var response = http.get(base + "/api/v1/orgs/" + output.detailOrg + "/sessions/" + output.detailId, { headers: { Cookie: cookie[0] } });
if (!response.ok) throw new Error("lecture de la séance refusée");
var block = json(response.body).draft.blocks[0];
function item(ref) {
  for (var i = 0; i < block.items.length; i++) if (block.items[i].ref === ref) return block.items[i];
  throw new Error("exercice perdu : " + ref);
}
var plan = item("detail-a").prescription.setPlan;
if (!plan || plan.length !== 3) throw new Error("détail série par série absent");
if (plan[0].warmup !== true || plan[0].reps !== 8 || plan[0].load.value !== 40) throw new Error("série d'échauffement altérée");
if (plan[1].warmup || plan[1].reps !== 5 || plan[1].load.value !== 60) throw new Error("série de travail altérée");
if (item("detail-a").prescription.reps !== 5 || item("detail-a").prescription.sets !== 3) throw new Error("résumé des anciens clients faux");
var root = block.sequence.map(function (node) { return node.itemRef || node.ref; }).join(",");
if (root !== "detail-a,detail-round,detail-b") throw new Error("sortie du groupe non enregistrée : " + root);
var replaced = item("detail-c").autonomous;
if (!replaced || replaced.exerciseId !== output.replacementId) throw new Error("remplacement en autonomie absent");
if (replaced.prescription.sets !== 1) throw new Error("le remplacement dans un groupe doit compter une série par tour");
output.detailVerified = "oui";
