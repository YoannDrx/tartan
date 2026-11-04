// Lecture seule : pnpm --filter @tartan/web exec tsx --env-file=.env scripts/adult-audit.ts
// N'affiche que des comptes : jamais une date, un nom ni une adresse.
import { ageStatus } from "@tartan/domain";
import { prisma } from "@/lib/prisma";

const iso = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

const main = async () => {
  const now = new Date();
  const [profiles, sheets, guardians] = await Promise.all([
    prisma.profile.findMany({ select: { birthDate: true } }),
    prisma.athlete.findMany({ select: { birthDate: true } }),
    prisma.guardian.count(),
  ]);
  const count = (rows: { birthDate: Date | null }[], status: string) =>
    rows.filter((row) => ageStatus(iso(row.birthDate), now) === status).length;
  console.log(`Profils mineurs : ${count(profiles, "minor")}`);
  console.log(`Profils sans date : ${count(profiles, "unknown")}`);
  console.log(`Fiches mineures : ${count(sheets, "minor")}`);
  console.log(`Fiches sans date : ${count(sheets, "unknown")}`);
  console.log(`Lignes Guardian : ${guardians}`);
  await prisma.$disconnect();
};

void main();
