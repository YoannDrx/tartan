import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SpaceSummary } from "@tartan/contracts";
import { isStaff } from "@tartan/domain";
import { getActor, type Actor } from "@/lib/session";
import { AppError, unauthorized } from "@/lib/errors";
import { RETURN_PATH_HEADER, signInPath } from "@/lib/return-path";
import { ageStatusOfUser } from "@/server/age.service";
import { listSpaces } from "@/server/me.service";
import { SPACE_COOKIE } from "./space-cookie";

export { SPACE_COOKIE };

export type SpaceContext = {
  actor: Actor;
  spaces: SpaceSummary[];
  space: SpaceSummary;
  organizationId: string;
  staff: boolean;
  // Espace personnel d'un athlète autonome : athlète de sa fiche, il y planifie pour lui seul.
  personal: boolean;
  // Ouvre le calendrier de planification, le constructeur, les modèles et le planificateur.
  planner: boolean;
};

const pick = (spaces: SpaceSummary[], wanted: string | undefined): SpaceSummary | undefined =>
  spaces.find((s) => s.organizationId === wanted) ?? spaces[0];

// Pour les pages : renvoie vers la connexion ou l'accueil coach si besoin.
export const requireSpace = async (): Promise<SpaceContext> => {
  const actor = await getActor();
  // La page demandée suit dans `next` : après la connexion, on y revient au lieu de retomber sur l'accueil.
  if (!actor) redirect(signInPath((await headers()).get(RETURN_PATH_HEADER)));
  const spaces = await listSpaces(actor.userId, { includeDemo: true });
  const jar = await cookies();
  const space = pick(spaces, jar.get(SPACE_COOKIE)?.value);
  // Sans espace, la création d'espace demande elle-même la date et traite un compte mineur.
  if (!space) redirect("/bienvenue");
  if ((await ageStatusOfUser(actor.userId)) !== "adult") redirect("/confirmer-age");
  const personal = space.kind === "personal";
  const staff = isStaff(space.role);
  return { actor, spaces, space, organizationId: space.organizationId, staff, personal, planner: staff || personal };
};

export const requireStaffSpace = async (): Promise<SpaceContext> => {
  const ctx = await requireSpace();
  if (!ctx.staff) redirect("/aujourdhui");
  return ctx;
};

// Les écrans de planification : l'équipe d'un espace de coach, ou l'athlète autonome dans son espace personnel.
export const requirePlannerSpace = async (): Promise<SpaceContext> => {
  const ctx = await requireSpace();
  if (!ctx.planner) redirect("/aujourdhui");
  return ctx;
};

export const requireAthleteSpace = async (): Promise<SpaceContext> => {
  const ctx = await requireSpace();
  if (ctx.staff) redirect("/suivi");
  return ctx;
};

// L'espace en cours, choisi au sélecteur ou à l'entrée dans la démonstration.
export const writeSpaceCookie = async (organizationId: string): Promise<void> => {
  const jar = await cookies();
  jar.set(SPACE_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
};

// Pour les actions : l'organisation vient du cookie, le service vérifie l'appartenance.
export const currentOrganizationId = async (actor: Actor): Promise<string> => {
  const spaces = await listSpaces(actor.userId, { includeDemo: true });
  const jar = await cookies();
  const space = pick(spaces, jar.get(SPACE_COOKIE)?.value);
  if (!space) throw unauthorized();
  return space.organizationId;
};

export const orNotFound = async <T>(load: () => Promise<T>): Promise<T> => {
  try {
    return await load();
  } catch (error) {
    // Un identifiant mal formé dans l'adresse est une page introuvable, pas une panne.
    const badId = typeof error === "object" && error !== null && "code" in error && error.code === "P2007";
    if (badId || (error instanceof AppError && (error.status === 403 || error.status === 404))) {
      const { notFound } = await import("next/navigation");
      notFound();
    }
    throw error;
  }
};
