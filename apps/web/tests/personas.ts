import type { PlanKey } from "@tartan/domain";
import { auth } from "@/lib/auth";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { setConsent } from "@/server/consent.service";
import { syncEntitlements } from "@/server/subscription-state.service";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

// Les comptes de docs/tests/comptes.md, construits en base en un appel.
// Équivalent Playwright : e2e/personas.ts.

const ORIGIN = "http://localhost:3000";

const setPlan = async (organizationId: string, plan: PlanKey) => {
  await prisma.organization.update({ where: { id: organizationId }, data: { plan } });
  await syncEntitlements(organizationId, plan);
};

const spaceWithPlan = async (name: string, plan: PlanKey) => {
  const space = await makeOrg(name);
  await setPlan(space.organizationId, plan);
  return space;
};

export const buildPersonas = async () => {
  // Espace principal : offre Pilote, sans limite, deux groupes.
  const main = await makeOrg("Proprio");
  const secondGroup = await prisma.group.create({
    data: { organizationId: main.organizationId, name: "Longueur Avenir" },
    select: { id: true },
  });
  const groups = { first: main.groupId, second: secondGroup.id };
  // Coach invité sur le premier groupe, adjoint limité au second.
  const coach = await addStaff(main.organizationId, "CoachInvite", "coach", [groups.first]);
  const adjoint = await addStaff(main.organizationId, "Adjoint", "assistant", [groups.second]);
  const athlete = await addAthlete(main.organizationId, groups.first, "Lea");
  const athleteAutreGroupe = await addAthlete(main.organizationId, groups.second, "Hugo");
  const athleteSansAccord = await addAthlete(main.organizationId, groups.first, "Nina", {
    health: false,
    video: false,
  });

  // Un autre espace, étanche au premier.
  const other = await makeOrg("AutreEspace");
  const otherAthlete = await addAthlete(other.organizationId, other.groupId, "Zoe");

  // Compte présent dans deux espaces : coach de l'autre espace, athlète du principal.
  const deuxEspaces = await addStaff(other.organizationId, "DeuxEspaces", "coach", [other.groupId]);
  await prisma.organizationMember.create({
    data: { organizationId: main.organizationId, userId: deuxEspaces.userId, role: "athlete", status: "active" },
  });
  const deuxEspacesFiche = await prisma.athlete.create({
    data: {
      organizationId: main.organizationId,
      userId: deuxEspaces.userId,
      firstName: "DeuxEspaces",
      lastName: "Test",
      groups: { create: { groupId: groups.second } },
    },
    select: { id: true },
  });
  for (const kind of ["terms", "health", "video"] as const) {
    await setConsent(deuxEspaces.userId, kind, true, deuxEspacesFiche.id);
  }

  // Administrateur de la plateforme : aucun espace, donc aucun droit sur les données d'un espace.
  const admin = await makeUser("Admin");
  await prisma.platformAdmin.create({ data: { email: admin.email } });

  // Un propriétaire par offre vendue.
  const [decouverte, offreCoach, club] = await Promise.all([
    spaceWithPlan("Decouverte", "discovery"),
    spaceWithPlan("OffreCoach", "coach"),
    spaceWithPlan("Club", "club"),
  ]);

  return {
    main: { organizationId: main.organizationId, groups },
    other: { organizationId: other.organizationId, groupId: other.groupId, athlete: otherAthlete },
    proprietaire: main.owner,
    coach,
    adjoint,
    athlete,
    athleteAutreGroupe,
    athleteSansAccord,
    autreEspace: other.owner,
    deuxEspaces: { ...deuxEspaces, athleteId: deuxEspacesFiche.id },
    admin,
    offres: { decouverte, coach: offreCoach, club },
  };
};

export type Personas = Awaited<ReturnType<typeof buildPersonas>>;

// Une vraie session Better Auth, obtenue comme en production : par le lien magique.
// Le cookie renvoyé est signé par la bibliothèque, aucune partie de la session n'est simulée.
export const sessionCookie = async (email: string): Promise<string> => {
  const headers = { "Content-Type": "application/json", origin: ORIGIN };
  const asked = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, callbackURL: "/accueil" }),
    }),
  );
  if (asked.status !== 200) throw new Error(`Lien magique refusé : ${asked.status}`);
  const mail = outbox.filter((sent) => sent.to === email).at(-1);
  const link = mail?.html.match(/href="([^"]+magic-link[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!link) throw new Error("Lien magique introuvable dans la boîte d'envoi de test");
  const verified = await auth.handler(new Request(link, { headers: { origin: ORIGIN } }));
  const cookie = verified.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0]!)
    .filter((entry) => entry.includes("session_token="))
    .join("; ");
  if (!cookie) throw new Error("Aucun cookie de session après le lien magique");
  return cookie;
};
