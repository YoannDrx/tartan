# Sauvegarde et restauration de la base

L'offre gratuite de Neon ne permet de revenir que 6 heures en arrière. Pour tenir le § 15.5 du cahier sans payer, une copie part chaque nuit à 2 h 30 UTC, gardée 30 jours.

- **Où :** artefacts GitHub Actions du dépôt privé, atelier `.github/workflows/sauvegarde.yml`.
- **Chiffrement :** la copie est chiffrée avant de quitter l'atelier, avec [age](https://age-encryption.org). Le dépôt ne contient que la clé publique.
- **Clé privée :** `~/.tartan/cle-sauvegarde.txt` sur ton Mac. **Sans elle, aucune copie n'est lisible.** Mets-la dans ton gestionnaire de mots de passe.
- **Si l'atelier échoue :** GitHub t'envoie un e-mail.

## En place

- **Accès :** le secret GitHub `NEON_BACKUP_URL` utilise le rôle `tartan_sauvegarde`, en lecture seule (contrôlé : ni écriture, ni suppression, ni création).
- **Essai réel, 2 novembre 2026 :** la copie de production a été téléchargée, déchiffrée et restaurée sur une base locale vide. 53 tables, comptes, espaces, groupes, exercices et migrations identiques à la production. La séance publiée 30 secondes après le départ de la copie n'y figure pas, ce qui est normal.

Pour lancer une copie à la main :

```bash
gh workflow run sauvegarde.yml --repo YoannDrx/tartan
```

## Restaurer

Récupère la copie voulue et charge-la dans une base **vide**, jamais directement sur la production :

```bash
gh run download <numéro-du-run> --repo YoannDrx/tartan --dir /tmp/tartan-restauration
```

```bash
age --decrypt --identity ~/.tartan/cle-sauvegarde.txt /tmp/tartan-restauration/*/tartan.dump.age | pg_restore --no-owner --no-privileges --dbname "<adresse-de-la-base-vide>"
```

En cas de vrai sinistre : crée une branche vide dans Neon, restaure dedans, vérifie, puis fais pointer `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dessus sur Vercel. Efface la copie déchiffrée de ton Mac ensuite.

## Ce que ça ne couvre pas

Les données saisies depuis la dernière copie sont perdues, sauf dans les 6 heures où Neon peut encore revenir en arrière. Les vidéos sont chez Mux et ne font pas partie de cette copie. Au moment de la vente, Neon Launch (restauration sur 7 jours) redevient le bon choix.
