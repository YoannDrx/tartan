// Migrations appliquées au build de production uniquement : les previews n'y touchent pas.
import { execFileSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
} else {
  console.log(`Migrations ignorées (${process.env.VERCEL_ENV ?? "local"}).`);
}
