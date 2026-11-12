import { gameEraseInput, gameScoreInput } from "@tartan/contracts";
import { clientIp } from "@/lib/client-ip";
import { readJsonBody, route } from "@/lib/zod-route";
import { eraseGameScores, submitGameScore } from "@/server/game.service";

// L'envoi d'un score : le serveur rejoue le journal des appuis et calcule lui-même la marque.
export const POST = route
  .body(gameScoreInput)
  .handler(async (request, { body }) => submitGameScore(body, clientIp(request)));

// L'effacement, sans compte : tous les scores de l'appareil. next-zod-route ne lit pas le corps d'un DELETE.
export const DELETE = route.handler(async (request) => eraseGameScores(await readJsonBody(request, gameEraseInput)));
