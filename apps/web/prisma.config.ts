import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Les migrations passent par la connexion directe ; le pool sert à l'exécution.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? env("DATABASE_URL") },
});
