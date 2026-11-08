# Évaluer le planificateur IA

Le corpus versionné est dans `apps/web/evals/planner-corpus.ts` : 60 consignes fictives, dont 30 propositions attendues et 30 ambiguïtés/refus de périmètre devant conduire à une clarification. Les 30 premières servent aussi de scripts à enregistrer ; **elles ne sont pas des dictées humaines tant que les enregistrements ne sont pas réalisés**.

Les attendus précisent exercices, destinataires, dates, horaires si dictés et valeurs de prescription. L’évaluateur compare ces valeurs, compte les différences et échoue sur des séances superflues, des questions manquantes ou une proposition remplacée inutilement par une question. Il ne mesure pas la qualité des titres, des notes ou de la formulation des questions. Le compteur automatique de différences est une borne basse de corrections, pas la mesure de corrections réellement faites par un coach.

## Exécution

Validation locale sans clé ni réseau :

```sh
corepack pnpm --filter @tartan/web eval:planner
```

Appels réels explicites, sur une sélection ou le corpus entier :

```sh
corepack pnpm --filter @tartan/web eval:planner --live --ids P01,P03,C01 --output .local/planner-eval-reference.json
corepack pnpm --filter @tartan/web eval:planner --live --resume .local/planner-eval-reference.json
```

La deuxième commande poursuit uniquement les cas absents du rapport. Aucun appel n’est rejoué automatiquement après échec, même si sa réponse est inutilisable. Un rapport contient commit, état modifié, empreinte du corpus, empreinte de l’adaptateur/contrats/évaluateur, modèle, dates, latences, réponses fictives et différences. La reprise refuse un corpus, un modèle ou une implémentation modifiés. Pour mesurer une nouvelle version, créer un autre rapport ; conserver le précédent pour comparer. Ne pas ajuster silencieusement les attendus après avoir vu les réponses.

`--live` utilise la clé serveur déjà configurée, puis celle du `.env.local` racine si nécessaire, sans l’afficher ni copier les autres secrets. Il ne change aucun drapeau externe et n’utilise ni base, ni séance, ni quota d’espace. Le stockage prestataire reste désactivé par l’adaptateur. Les rapports sont écrits dans `.local` ignoré par Git, après chaque cas, pour reprendre après interruption. Les résultats ne doivent jamais être alimentés avec de vraies données d’athlètes par remplacement du corpus.

## Décision avant bêta

Les attendus du plan restent : clarification sur tous les cas ambigus, aucun maximum individuel inventé, au moins 95 % de rattachements corrects des exercices non ambigus (les autres doivent demander confirmation), et réussite complète des tests d’accès/absence d’écriture sans validation. Les tests API et services vérifient les droits et écritures ; ce runner de prestataire ne peut pas les remplacer.

Le rapport reste `betaQualified: false` : trente enregistrements consentis ou scénarisés, essais de bruit/interruption sur appareils, revue humaine et nombre de corrections coach restent à documenter. Les champs `humanAudio` et `coachCorrections` restent null, sans zéro inventé. Après les enregistrements, il faudra lier leur provenance et les résultats de transcription puis rejouer l’interprétation sur les transcriptions effectivement reçues. La relecture de notes et titres devra aussi rechercher les inférences non demandées, dont toute valeur individuelle de force. Une réussite JSON ou une voix synthétique ne suffit pas.
