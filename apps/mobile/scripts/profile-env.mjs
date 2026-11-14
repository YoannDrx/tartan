// Les variables d'un profil de build d'eas.json, héritage compris, en lignes `export NOM='valeur'`.
// Une mise à jour à distance doit porter exactement la configuration du binaire qu'elle vise : sans elle,
// `eas update` retombe sur la variante de développement et vise http://localhost:3000.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const profileEnv = (eas, name) => {
  const profile = eas.build[name];
  if (!profile) throw new Error(`Profil EAS inconnu : ${name}`);
  const parent = profile.extends ? profileEnv(eas, profile.extends) : {};
  return { ...parent, ...(profile.env ?? {}) };
};

export const profileChannel = (eas, name) => {
  const profile = eas.build[name];
  if (!profile) throw new Error(`Profil EAS inconnu : ${name}`);
  return profile.channel ?? (profile.extends ? profileChannel(eas, profile.extends) : undefined);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
  const name = process.argv[2];
  const env = profileEnv(eas, name);
  for (const [key, value] of Object.entries(env)) console.log(`export ${key}='${String(value).replaceAll("'", "'\\''")}'`);
  console.log(`export EAS_CHANNEL='${profileChannel(eas, name)}'`);
}
