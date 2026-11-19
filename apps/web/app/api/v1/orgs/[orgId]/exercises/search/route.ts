import { exerciseFamily, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { searchExercises } from "@/server/exercise.service";
import { orgParams } from "../../../../_params";

// Recherche paginée dans la bibliothèque, sans les guides. `filter` vaut all, favorites, mine, family ou list.
const query = z
  .object({
    q: z.string().max(120).optional(),
    filter: z.enum(["all", "favorites", "mine", "family", "list"]).default("all"),
    family: exerciseFamily.optional(),
    listId: uuid.optional(),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(40),
  })
  .refine((value) => (value.filter === "family" ? value.family : value.filter === "list" ? value.listId : true));

export const GET = authRoute
  .params(orgParams)
  .query(query)
  .handler(async (_req, { ctx, params, query: { filter, family, listId, ...rest } }) =>
    searchExercises(ctx.actor.userId, params.orgId, {
      ...rest,
      filter:
        filter === "family"
          ? { kind: "family", family: family! }
          : filter === "list"
            ? { kind: "list", listId: listId! }
            : { kind: filter },
    }),
  );
