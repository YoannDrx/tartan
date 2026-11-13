#!/usr/bin/env node
// Copies chiffrées de la base dans un store Vercel Blob privé, hors de GitHub (lot A13).
//   node scripts/sauvegarde-blob.mjs envoyer <fichier.dump.age>
//   node scripts/sauvegarde-blob.mjs purger [jours, 30 par défaut]
//   node scripts/sauvegarde-blob.mjs lister
//   node scripts/sauvegarde-blob.mjs telecharger <nom> <fichier de sortie>
// Jeton : BACKUP_BLOB_TOKEN, celui du seul store des sauvegardes, jamais celui de l'application. Il n'est jamais affiché.
// La copie est chiffrée par age avant l'envoi : le store ne voit qu'un fichier illisible sans la clé privée.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export const PREFIX = "sauvegardes/";
const DAY_MS = 24 * 60 * 60 * 1000;

// Nom daté, triable, sans suffixe aléatoire : une copie par nuit, lisible dans la console Vercel.
export const backupName = (now) => `${PREFIX}tartan-${now.toISOString().slice(0, 16).replace(":", "-")}.dump.age`;

// Copies à supprimer : plus vieilles que `days` jours, sauf la plus récente, gardée quoi qu'il arrive.
export const expiredBackups = (blobs, now, days) => {
  const ours = blobs.filter((blob) => blob.pathname.startsWith(PREFIX));
  if (ours.length === 0) return [];
  const newest = ours.reduce((a, b) => (new Date(a.uploadedAt) >= new Date(b.uploadedAt) ? a : b));
  const limit = now.getTime() - days * DAY_MS;
  return ours.filter((blob) => blob !== newest && new Date(blob.uploadedAt).getTime() < limit);
};

// Empreinte d'un flux d'octets : la copie relue depuis Blob doit être identique à celle envoyée.
export const sha256 = async (stream) => {
  const hash = createHash("sha256");
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
};

const fail = (message) => {
  console.error(`sauvegarde-blob : ${message}`);
  process.exit(1);
};

const token = () => {
  const value = process.env.BACKUP_BLOB_TOKEN?.trim();
  if (!value) fail("BACKUP_BLOB_TOKEN absent.");
  return value;
};

const listAll = async (blob, auth) => {
  const all = [];
  let cursor;
  do {
    const page = await blob.list({ prefix: PREFIX, cursor, limit: 1000, token: auth });
    all.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  const blob = await import("@vercel/blob");
  const auth = token();
  if (command === "envoyer") {
    const file = args[0];
    if (!file) fail("fichier à envoyer manquant.");
    const size = statSync(file).size;
    if (size === 0) fail(`${basename(file)} est vide.`);
    const name = backupName(new Date());
    await blob.put(name, createReadStream(file), {
      access: "private",
      token: auth,
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/octet-stream",
      multipart: true,
    });
    const check = await blob.head(name, { token: auth });
    if (check.size !== size) fail(`taille relue ${check.size} au lieu de ${size}.`);
    // Aller-retour : la copie est relue depuis le store et comparée octet par octet, sans la déchiffrer.
    const local = await sha256(createReadStream(file));
    const back = await blob.get(name, { access: "private", token: auth, useCache: false });
    if (!back || !back.stream) fail(`${name} introuvable à la relecture.`);
    const remote = await sha256(Readable.fromWeb(back.stream));
    if (remote !== local) fail(`${name} relue différente de la copie envoyée.`);
    console.log(`Envoyée et relue à l'identique : ${name} (${size} octets, sha256 ${local.slice(0, 12)}…).`);
  } else if (command === "purger") {
    const days = Number(args[0] ?? 30);
    if (!Number.isInteger(days) || days < 7) fail("garder au moins 7 jours de copies.");
    const old = expiredBackups(await listAll(blob, auth), new Date(), days);
    if (old.length) await blob.del(old.map((item) => item.url), { token: auth });
    console.log(`Supprimées : ${old.length} copie(s) de plus de ${days} jours.`);
  } else if (command === "lister") {
    const all = await listAll(blob, auth);
    for (const item of all.sort((a, b) => String(a.uploadedAt).localeCompare(String(b.uploadedAt)))) {
      console.log(`${item.pathname}\t${item.size} octets\t${new Date(item.uploadedAt).toISOString()}`);
    }
    console.log(`${all.length} copie(s).`);
  } else if (command === "telecharger") {
    const [name, output] = args;
    if (!name || !output) fail("usage : telecharger <nom> <fichier de sortie>.");
    const pathname = name.startsWith(PREFIX) ? name : `${PREFIX}${name}`;
    const result = await blob.get(pathname, { access: "private", token: auth, useCache: false });
    if (!result || !result.stream) fail(`${pathname} introuvable.`);
    await pipeline(Readable.fromWeb(result.stream), createWriteStream(output));
    console.log(`Téléchargée : ${pathname} vers ${output}.`);
  } else {
    fail("commande inconnue : envoyer, purger, lister ou telecharger.");
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
