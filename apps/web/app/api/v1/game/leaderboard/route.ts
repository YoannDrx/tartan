import { gameLeaderboardQuery } from "@tartan/contracts";
import { route } from "@/lib/zod-route";
import { gameLeaderboard } from "@/server/game.service";

// Le classement d'une épreuve. Classement éteint : `enabled: false`, aucune ligne.
export const GET = route.query(gameLeaderboardQuery).handler(async (_request, { query }) => gameLeaderboard(query));
