"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "@/lib/errors";
import { spaceAction } from "@/features/shell/space-action";
import { writeSpaceCookie } from "@/features/shell/space";
import { listSpaces } from "@/server/me.service";
import { deleteDemoSpace, openDemoSpace } from "@/server/demo-space.service";

// L'espace réel où revenir : le premier où le coach encadre, la démonstration exclue.
const realSpaceOf = async (userId: string): Promise<string> => {
  const spaces = await listSpaces(userId);
  const home = spaces.find((space) => space.role !== "athlete") ?? spaces[0];
  if (!home) throw forbidden();
  return home.organizationId;
};

// Ouvre (ou remet à zéro) la démonstration, puis y entre : le coach la voit aussitôt.
export const openDemoSpaceAction = spaceAction.action(async ({ ctx }) => {
  const demo = await openDemoSpace(ctx.userId, ctx.organizationId);
  await writeSpaceCookie(demo.organizationId);
  revalidatePath("/", "layout");
  return demo;
});

// Retour à l'espace réel, sans rien supprimer.
export const leaveDemoSpaceAction = spaceAction.action(async ({ ctx }) => {
  await writeSpaceCookie(await realSpaceOf(ctx.userId));
  revalidatePath("/", "layout");
});

// Suppression immédiate, depuis la démonstration ou depuis l'espace réel ; on revient toujours à l'espace réel.
export const deleteDemoSpaceAction = spaceAction.action(async ({ ctx }) => {
  const deleted = await deleteDemoSpace(ctx.userId, ctx.organizationId);
  await writeSpaceCookie(await realSpaceOf(ctx.userId));
  revalidatePath("/", "layout");
  return { deleted };
});
