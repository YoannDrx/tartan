// Point hebdomadaire avec le coach : pnpm --filter @tartan/web exec tsx --env-file=.env scripts/pilot-metrics.ts <organisationId>
import { prisma } from "@/lib/prisma";
import { pilotMetrics } from "@/server/metrics.service";

const organizationId = process.argv[2];
if (!organizationId) throw new Error("Indique l'identifiant de l'organisation.");
console.log(await pilotMetrics(organizationId));
await prisma.$disconnect();
