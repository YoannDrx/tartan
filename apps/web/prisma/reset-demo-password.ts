// Remplace le mot de passe des comptes de revue des stores. Ne touche qu'aux adresses @demo.tartan.coach.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_DOMAIN = "@demo.tartan.coach";

const main = async () => {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("DEMO_PASSWORD manquant ou trop court.");
  const ctx = await auth.$context;
  const users = await prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { id: true } });
  if (users.length === 0) throw new Error("Aucun compte de revue trouvé.");
  const hash = await ctx.password.hash(password);
  const { count } = await prisma.account.updateMany({
    where: { providerId: "credential", userId: { in: users.map((user) => user.id) } },
    data: { password: hash },
  });
  if (count !== users.length) throw new Error(`Comptes mis à jour : ${count} sur ${users.length}.`);
  console.log(`Mot de passe remplacé pour ${count} comptes de revue.`);
};

await main();
await prisma.$disconnect();
