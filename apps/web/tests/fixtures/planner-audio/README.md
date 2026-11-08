# Échantillons audio techniques

Deux secondes de silence synthétique, générées avec FFmpeg le 8 novembre 2026. Aucun enregistrement humain, média tiers ou donnée personnelle. Ces fichiers testent les conteneurs et la mesure de durée, pas la reconnaissance vocale.

- `silence.m4a` : mono 16 kHz, AAC 32 kbit/s.
- `silence-live.webm` : mono 48 kHz, Opus 24 kbit/s, conteneur live sans durée globale renseignée, analogue aux enregistrements MediaRecorder.

Reproduction depuis la racine :

```sh
ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 2 -c:a aac -b:a 32000 -map_metadata -1 apps/web/tests/fixtures/planner-audio/silence.m4a
ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 2 -c:a libopus -b:a 24000 -map_metadata -1 -live 1 apps/web/tests/fixtures/planner-audio/silence-live.webm
```

Les variantes `too-long.m4a` et `too-long-live.webm` utilisent les mêmes commandes avec `-t 181` et restent inférieures à 3 Mio : elles vérifient que la taille ne remplace pas le contrôle de durée. `two-tracks.m4a` contient une seconde piste mono silencieuse (`-t 1 -map 0:a -map 0:a`) et doit être refusé. `video-only.mp4` est une image noire 16 × 16 encodée pendant une seconde (`-f lavfi -i color=c=black:s=16x16:r=1 -t 1 -c:v libx264`), sans piste audio ; ce n'est pas un média produit.
