# Sauvegarde et restauration de la base

L'offre gratuite de Neon ne permet de revenir que 6 heures en arrière. Pour tenir le § 15.5 du cahier sans payer, une copie part chaque nuit à 2 h 30 UTC, gardée 30 jours.

- **Où :** artefacts GitHub Actions du dépôt privé, atelier `.github/workflows/sauvegarde.yml`.
- **Chiffrement :** la copie est chiffrée avant de quitter l'atelier, avec [age](https://age-encryption.org). Le dépôt ne contient que la clé publique.
- **Clé privée :** `~/.tartan/cle-sauvegarde.txt` sur ton Mac. **Sans elle, aucune copie n'est lisible.** Mets-la dans ton gestionnaire de mots de passe.
- **Si l'atelier échoue :** GitHub t'envoie un e-mail.

## Mise en route, une seule fois

Dans la console Neon, bouton **Connect**, branche `production`, **Connection pooling désactivé**, copie l'adresse. Puis, en collant l'adresse quand c'est demandé :

```bash
gh secret set NEON_BACKUP_URL --repo YoannDrx/tartan
```

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
