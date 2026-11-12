import { gameRunInput } from "@tartan/contracts";
import { clientIp } from "@/lib/client-ip";
import { route } from "@/lib/zod-route";
import { startGameRun } from "@/server/game.service";

// Le départ d'un essai classé : la graine et le jeton à usage unique. Fermé tant que le classement est éteint.
export const POST = route
  .body(gameRunInput)
  .handler(async (request, { body }) => startGameRun(body, clientIp(request)));
