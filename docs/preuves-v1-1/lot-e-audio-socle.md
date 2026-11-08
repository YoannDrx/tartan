# Mesure audio serveur et premier essai de transcription

8 novembre 2026, depuis `bbe5572`, PR #45 en brouillon.

## Contrôles et adaptateur

Le serveur inspecte les octets avec Mediabunny 1.65.2 et calcule la durée depuis les paquets, sans utiliser le nom, le MIME ou la durée fournis par le client. Formats admis : WAV, MP4/M4A et WebM ; une seule piste audio, aucune piste vidéo, au maximum trois minutes et 3 Mio. Une durée inconnue, un fichier tronqué, vide ou non audio est refusé. La durée facturable est arrondie à la seconde supérieure ; l'avance de décodage négative est incluse. L'inspection dispose d'une borne de cinq secondes et ferme ses ressources. Aucun fichier audio n'est écrit par ce code serveur.

L'adaptateur de transcription appelle uniquement `/v1/audio/transcriptions`, conserve la clé côté serveur, utilise un nom de fichier technique et ne relance pas automatiquement une requête potentiellement facturée. Les erreurs ne reproduisent ni corps fournisseur ni texte. La transcription doit être non vide et limitée à 12 000 caractères avant relecture. Un lexique public de préparation physique aide à reconnaître les termes sportifs ; il ne constitue pas une attribution d'exercice de bibliothèque.

Le modèle initial configurable `gpt-4o-mini-transcribe` est conservé conformément au plan. La configuration `gpt-transcribe` est également prise en charge avec les champs de langue et de vocabulaire correspondants. **Le modèle initial est déprécié, avec arrêt annoncé le 26 février 2027** : une évaluation et un changement de configuration seront nécessaires avant cette date. Ce nouveau modèle n'a pas été testé en réel dans ce lot. [Documentation OpenAI consultée le 8 novembre](https://developers.openai.com/api/docs/guides/speech-to-text).

## Preuves

- **32 tests ciblés réussis**, dont 15 sur les fichiers audio, huit sur l'adaptateur de transcription et neuf sur l'interprétation existante. Les fixtures silencieuses sont synthétiques, sans voix personnelle ; WebM live sans durée globale, M4A, PCM, dépassement de durée sous 3 Mio, vidéo et pistes multiples sont couverts.
- **649 tests serveur réussis**, 66 fichiers, 58,02 s ; types monorepo et lint ciblé réussis. Installation avec verrou figé réussie. Le diff de dépendances est limité à Mediabunny et ses deux dépendances de types ; aucune mise à jour Expo/React n'est embarquée.
- Essai réel OpenAI avec une **voix synthétique locale Thomas**, consigne fictive de squat arrière 3 × 4 × 40 kg, récupération deux minutes. Audio M4A de **10,40425 s**, **43 775 octets**.
- Deux appels initiaux sans lexique ont conservé séries, répétitions, charge et repos, mais transcrit le nom d'exercice en « sca arrière ». Ils sont **échoués** pour l'exactitude de l'exercice ; un test strict n'a pas été assoupli pour les faire passer.
- Après ajout du lexique public, appel du **8 novembre à 05:04:50 UTC**, modèle `gpt-4o-mini-transcribe` : exercice et quatre valeurs corrects, **1 046 ms**. Trois appels de diagnostic au total. Aucun compte client, audio humain ou donnée de santé transmis ; aucune écriture en base ni activation IA.

## Limites

Ces helpers ne sont pas encore accessibles à l'utilisateur : il reste à raccorder la réservation de secondes, le résultat récupérable après réponse perdue, sa purge et la route d'envoi. Il reste également à intégrer l'enregistrement web et natif `expo-audio`, les permissions, interruptions et suppressions locales. Les fichiers silencieux ne valident pas la reconnaissance vocale ; une phrase synthétique réussie ne remplace ni les trente dictées du corpus ni les essais sur téléphones.

La relecture avant interprétation reste obligatoire. La durée de conservation chez OpenAI dépend de la configuration effective ; aucun engagement de conservation distante n'est déduit de cette implémentation.

Référence de calcul : [Mediabunny — lecture des médias](https://github.com/vanilagy/mediabunny/blob/main/docs/guide/reading-media-files.md).
