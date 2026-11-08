# Lot E — capture audio web, 8 novembre 2026

État initial : contrôleur et composant de dictée web implémentés. Le raccordement et les essais Chromium ont depuis été réalisés : voir [le parcours web](lot-e-parcours-web.md). L’IA reste désactivée ; les essais synthétiques ne valident pas la dictée humaine.

## Capture et interruption

`BrowserPlannerRecording` sélectionne un conteneur déclaré compatible par le navigateur : WebM/Opus ou MP4/AAC. Le flux demandé est audio uniquement, mono, à 32 kbit/s souhaités. La limite locale est de 179 secondes et de 3 Mio ; les paquets sont contrôlés dès leur réception, puis le serveur mesure à nouveau le fichier complet. Le débit demandé n’est pas traité comme une garantie de taille ou de durée.

Le contrôleur attend le dernier paquet et l’événement d’arrêt avant de transmettre un unique Blob au composant. Les doubles appuis ne créent ni second enregistreur ni second résultat. Les pistes sont arrêtées avant cette remise. Les erreurs de construction, démarrage ou encodage libèrent le flux. Un arrêt spontané ou une perte de périphérique ne vaut jamais accord d’envoi. La finalisation est bornée à cinq secondes.

L’annulation n’attend pas la boîte de permission : si elle est acceptée tardivement, les pistes sont immédiatement arrêtées sans démarrer l’enregistrement. Les événements tardifs d’une capture annulée ne sont pas transmis. Aucun fichier, URL de Blob, cache persistant ou stockage local n’est créé par ce code.

## Composant web

Information explicite et acceptation avant capture. Le composant recontrôle l’accès par le SDK avant de demander le micro. La transcription reste derrière le même endpoint, les mêmes quotas et les mêmes validations que le natif. Un identifiant stable permet de relire un résultat après réponse perdue sans renvoyer l’audio. Pas de répétition automatique de la requête ; délais bornés pour accès, envoi et récupération. Un même résultat ne peut être ajouté deux fois.

Masquage de la page, départ et démontage arrêtent le micro et annulent la requête locale ; une demande déjà reçue par le serveur peut terminer, puis être récupérée tant que l’écran garde son identifiant. Les réponses d’un ancien montage ne modifient pas le nouvel écran. Les blobs sont uniquement en mémoire durant la capture et l’envoi. La transcription sera proposée au formulaire parent pour relecture, jamais envoyée automatiquement au planificateur.

Les libellés distinguent navigateur et téléphone, finalisation et transcription, interruption et résultat incertain. En cas de navigateur incompatible ou permission refusée, la consigne écrite reste le parcours de repli.

## Validation et limites

Neuf tests de cycle audio avec périphérique simulé réussis en 1,21 s : dernier paquet, doubles actions, permission tardive, annulation durant finalisation, taille, perte de micro, durée/finalisation, erreurs d’encodeur, contenu vide et type MP4. Le test du type MP4 n’est pas une preuve Safari : le périphérique y est simulé.

**678 tests serveur réussis** dans 69 fichiers en 57,29 s, types du monorepo réussis, lint ciblé sans erreur et contrôle design sans travers. La liste privée et sa route sont incluses dans cette suite.

Le raccordement au formulaire et les parcours Chromium avec micro synthétique sont désormais couverts par la preuve du parcours web. Safari/iOS, Chrome/Android physique, le corpus dicté et les essais humains restent à réaliser. Aucun appel OpenAI supplémentaire effectué pour ces tests.

Références consultées : [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), notamment arrêt et émission des paquets ; [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), notamment contexte sécurisé et permission pouvant rester sans réponse. Aucune disponibilité universelle n’est supposée.
