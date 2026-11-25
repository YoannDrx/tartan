// PNG carrées nommées <clé>-v<version image>.png. Le texte alternatif et la version sont relus dans le manifeste.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { catalogImages } from "../src/server/catalog-illustrations";

import { legacyCovers } from "../src/server/legacy-catalog-covers";

const web = path.resolve(import.meta.dirname, "..");
const output = path.join(web, "public/exercise-photos");
const registry = path.resolve(web, "../mobile/src/features/pilot-images.ts");
const entries = [...EXERCISE_CATALOG, ...STADIUM_EDITION];
const declared = new Set<string>();
for (const image of catalogImages) {
  const stem = image.key + "-v" + image.imageVersion;
  if (
    declared.has(stem) ||
    !image.alt.trim() ||
    !entries.some((entry) => entry.catalogKey === image.key && entry.catalogVersion === image.guideVersion)
  )
    throw Error("Illustration ou édition invalide : " + stem);
  declared.add(stem);
}

for (const cover of legacyCovers.values()) {
  if (!cover.alt.trim()) throw Error("Texte alternatif manquant : " + cover.key);
  declared.add(cover.key + "-v" + cover.imageVersion);
}

function installVersion(file: string, destination: string) {
  try {
    linkSync(file, destination);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    if (!readFileSync(file).equals(readFileSync(destination)))
      throw Error("Le fichier publié diffère. Augmente imageVersion avant de reprendre " + path.basename(destination));
  }
}

function main(args: string[]) {
  const check = args.length === 1 && args[0] === "--check";
  if (!args.length || (!check && args.some((arg) => !arg.endsWith(".png"))))
    throw Error("Usage : catalog:images --check | <clé>-v<N>.png […]");
  const staging = mkdtempSync(path.join(output, ".prepare-"));
  try {
    const staged: string[] = [];
    for (const input of check ? [] : args) {
      const stem = path.basename(input, ".png");
      if (!declared.has(stem)) throw Error("Inscris d’abord la clé, la version et le texte alternatif : " + stem);
      const png = readFileSync(input);
      if (
        png.length < 24 ||
        png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
        png.toString("ascii", 12, 16) !== "IHDR" ||
        png.readUInt32BE(16) !== png.readUInt32BE(20)
      )
        throw Error("Le fichier source doit être une image PNG carrée : " + stem);
      for (const [size, suffix] of [
        [488, ""],
        [168, "-thumb"],
      ] as const) {
        const filename = stem + suffix + ".webp";
        execFileSync(
          "cwebp",
          [
            "-quiet",
            "-metadata",
            "none",
            "-q",
            "85",
            "-resize",
            String(size),
            String(size),
            path.resolve(input),
            "-o",
            path.join(staging, filename),
          ],
          { stdio: "inherit" },
        );
        staged.push(filename);
      }
    }
    for (const name of staged) installVersion(path.join(staging, name), path.join(output, name));
    for (const stem of declared)
      for (const suffix of [".webp", "-thumb.webp"])
        if (!existsSync(path.join(output, stem + suffix))) throw Error("Ressource manquante : " + stem + suffix);

    // Les éditions précédentes restent embarquées pour les séances déjà conservées sur le téléphone.
    const names = readdirSync(output)
      .filter((name) => /^[a-z0-9-]+-v[1-9][0-9]*\.webp$/.test(name))
      .sort();
    const native =
      'import type { ImageSourcePropType } from "react-native";\n' +
      "export const pilotImages: Record<string, ImageSourcePropType> = {\n" +
      names
        .map(
          (name) => '  "/exercise-photos/' + name + '": require("../../../web/public/exercise-photos/' + name + '"),',
        )
        .join("\n") +
      "\n};\n";
    if (readFileSync(registry, "utf8") !== native) {
      if (check) throw Error("Le registre natif doit être actualisé avec les ressources de la série.");
      writeFileSync(path.join(staging, "native.ts"), native);
      renameSync(path.join(staging, "native.ts"), registry);
    }
    console.log(declared.size + " illustrations et vignettes disponibles, " + names.length + " images natives.");
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
main(process.argv.slice(2));
