import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect } from "@playwright/test";

// Les e-mails que le serveur des parcours n'envoie pas : il les dépose ici (`E2E_MAIL_DIR`, src/lib/mail.tsx), et le
// test relit le lien d'action pour le suivre comme le ferait la personne dans sa boîte. Hors du dépôt, un dossier
// par port : deux sessions sur le même poste ne lisent pas les messages l'une de l'autre.
export const MAIL_DIR = path.join(os.tmpdir(), `tartan-e2e-mail-${process.env.E2E_PORT ?? 3100}`);

type Captured = { to: string; subject: string; link: string | null };

const read = async (to: string): Promise<Captured[]> => {
  const files = (await readdir(MAIL_DIR).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const mails = await Promise.all(
    files.map(async (name) => JSON.parse(await readFile(path.join(MAIL_DIR, name), "utf8")) as Captured),
  );
  return mails.filter((mail) => mail.to === to);
};

// Les sujets des messages reçus par cette adresse, du plus ancien au plus récent.
export const subjectsFor = async (to: string): Promise<string[]> => (await read(to)).map((mail) => mail.subject);

// Le lien du dernier message de ce sujet. `count` attend qu'il y en ait au moins autant : après un renvoi, le
// deuxième message, pas le premier relu.
export const emailLink = async (to: string, subject: string, count = 1): Promise<string> => {
  let found: Captured[] = [];
  await expect
    .poll(
      async () => {
        found = (await read(to)).filter((mail) => mail.subject === subject);
        return found.length;
      },
      { message: `e-mail « ${subject} » attendu pour ${to}`, timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(count);
  const link = found.at(-1)?.link;
  if (!link) throw new Error(`L'e-mail « ${subject} » ne porte aucun lien`);
  return link;
};
