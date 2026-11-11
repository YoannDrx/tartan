# Journal de passation

Chaque agent ajoute une entrée en haut, à la fin de son travail. Cinq lignes suffisent. L'état d'avancement reste dans [ETAT.md](ETAT.md) : ici, seulement ce qu'un autre agent doit savoir pour reprendre.

Modèle :

```text
## AAAA-MM-JJ, agent, sujet
Fait : … (PR)
Vérifié : … / Non vérifié : …
En cours ou abandonné : branche, raison
À savoir : piège découvert, décision prise
Suite conseillée : numéro de tâche
```

## 2026-11-11, Claude, lot A8 : registre des e-mails

Fait : registre unique des 25 e-mails avec catégorie (`email-registry.ts`), exigé par `sendEmail` ; un rebond bloque tout, une plainte ou une désinscription épargne les e-mails de sécurité ; adresse qui rebondit annoncée au formulaire de connexion ; invitations passées par la file ; genre inconnu marqué en échec ; objets d'e-mail dans `packages/i18n` (PR `feat/email-registry`).
Vérifié : `tests/email-registry.test.ts` (douze cas), toute la suite web (847 tests), types, lint, design. Non vérifié : aucun envoi réel ; le lien de connexion, seul e-mail éprouvé en production, garde son envoi direct mais passe désormais par le contrôle de blocage avant le rendu ; Resend tient sa propre liste de suppression et peut refuser un envoi que Tartan laisse passer.
À savoir : le contrôle de blocage tourne aussi en local et en test, avant le rendu. La réinitialisation de mot de passe avale volontairement une adresse qui rebondit, pour ne pas révéler l'existence d'un compte. La file ne garde jamais le lien d'une invitation. `flushEmailOutbox` accepte une clé pour ne traiter qu'une ligne.
Suite conseillée : A9, puis A10.

## 2026-11-11, Claude, lot A4 : finitions du paiement

Fait : événement `invoice.payment_action_required` et son e-mail ; bandeau de paiement à régulariser dans tout l'espace coach, pour le propriétaire ; un message de plafond atteint mène aux offres ; liste des factures sur `/abonnement` ; rattrapage horaire élargi à 200 espaces dans un budget de 40 s ; CGV qui lisent les plafonds dans `plans.ts` (PR `feat/paiement-finitions`).
Vérifié : `tests/payment-action-required.test.ts` (dix cas), suites de facturation et d'e-mails, types, lint, design ; CGV regardées rendues en local à 390 px. Non vérifié : aucun événement réel de Stripe, la validation 3-D Secure n'a jamais été jouée ; le parcours `e2e/billing-alert.spec.ts` (bandeau, factures, axe à 390 px) est écrit mais n'a pas tourné en local, le port 3100 étant pris par une autre session : la CI le joue.
À savoir : le webhook de production ne reçoit pas le nouvel événement tant que `stripe-setup` n'est pas relancé (F14) ; la console l'affiche. Un incident de paiement n'envoie qu'un e-mail : celui de validation remplace « paiement échoué » s'il est en file dans la même heure, et s'efface si « paiement échoué » est déjà parti. Le lien vers les offres est reconnu par le texte du message de plafond, pour ne pas toucher vingt appels.
Suite conseillée : A8, puis A9.

## 2026-11-11, Claude, lot A3 : garde-fous de direction artistique

Fait : trois règles ESLint locales (`apps/web/eslint-rules`) : couleur brute, palette Tailwind par défaut, texte en dur dans le JSX et les attributs de libellé. 20 couleurs brutes corrigées (écrans vidéo, mode séance, ombres, page de paiement Stripe) ; rôles `on-ink`, `shadow-float` et `shadow-float-strong` ajoutés au thème (PR `feat/garde-fous-da`).
Vérifié : tests des règles, miroir des jetons, types, lint, design ; couleurs et ombres calculées identiques à l'ancien rendu, relevées dans le navigateur. Non vérifié : la suite Playwright complète n'a pas tourné en local, cinq sessions partageant le port 3100 et la base `tartan_e2e` ; elle tourne en CI.
À savoir : 274 textes hérités sont gelés dans `eslint-suppressions.json`, que le lint tolère sans jamais l'agrandir ; un test plafonne ce volume. Le lint passe `--pass-on-unpruned-suppressions` pour que des PR parallèles ne se bloquent pas ; `lint:prune` retire les entrées devenues inutiles. Dans une scène encre, le blanc s'écrit `text-fg` ; hors scène, sur un aplat encre, `text-on-ink`.
Suite conseillée : A4, puis A8.

## 2026-11-11, Claude, plan de fin de projet et documentation

Fait : audit du code, des écrans et de la documentation ; plan en lots approuvé par le fondateur (vente A1 à A13, direction artistique B1 à B9, ajouts C1 à C3, jeu J1 à J10) ; documentation remise à plat (PR `docs/remise-a-plat`). `PRODUCT.md` et `DESIGN.md` portent les décisions du 11 novembre. Nouveaux documents : direction artistique, incident, support, e-mails, onboarding.
Vérifié : liens entre documents contrôlés par script ; types, lint, tests et design après la correction de la signature des e-mails (« Yodev, entreprise individuelle »). Non vérifié : rien n'a été éprouvé en réel, aucun lot de code n'est commencé ; les chemins cités comme « à créer » n'existent pas encore.
En cours ou abandonné : rien.
À savoir : les anciennes tâches d'agent A1 à A12 sont renumérotées. A1 est devenu les lots A1, A2, A5, A6, A7 ; A2 et A4 le lot A13 ; les tâches mobiles M1 à M6 ; l'IA P1 et P2. La file d'e-mails expire tout message de plus de 24 h : une séquence se met en file le jour dû. Les liens de connexion ne passent pas par la file. La simulation du jeu doit rester en arithmétique entière. Les anciens audits non suivis ont quitté le dépôt.
Suite conseillée : A1 et A2 en parallèle, puis A3.

## 2026-11-09, Claude, remise en état et passation

Fait : webhook Mux réparé et rattrapage horaire (PR 48). Console Configuration, tarifs sur la landing, accord OpenAI, CGV, correctifs de l'audit des frontières (PR 49). Enrôlement de la passkey réparé (PR 50). Préparation des stores (PR 51). Documentation refondue.
Vérifié : lint, types, tests, design, Playwright sur build de production ; passkey créée en production ; vidéo réelle passée à prête.
Non vérifié : e-mails reçus, paiement réel, push, téléphones physiques.
À savoir : les variables Vercel de type Secret ne se relisent pas, même avec `vercel env run`. Une variable modifiée n'agit qu'après un nouveau déploiement. La bibliothèque de passkeys n'envoie pas `fetchOptions` à sa première requête.
Suite conseillée : A1, à commencer par T01.
