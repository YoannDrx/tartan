"use server";

import { catalogueKey } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import { CATALOG_VIEWS, createCatalogVideoUpload, removeCatalogVideo } from "@/server/catalog-media.service";

const target = z.object({ catalogKey: catalogueKey, view: z.enum(CATALOG_VIEWS) });

// L'adresse d'envoi direct vers Mux, pour la vidéo d'une fiche commune et d'une vue.
export const catalogVideoUploadAction = adminAction.inputSchema(target).action(async ({ ctx, parsedInput }) => {
  const upload = await createCatalogVideoUpload(ctx.actor, parsedInput.catalogKey, parsedInput.view);
  revalidatePath("/admin/exercices");
  return upload;
});

export const removeCatalogVideoAction = adminAction.inputSchema(target).action(async ({ ctx, parsedInput }) => {
  await removeCatalogVideo(ctx.actor, parsedInput.catalogKey, parsedInput.view);
  revalidatePath("/admin/exercices");
});
