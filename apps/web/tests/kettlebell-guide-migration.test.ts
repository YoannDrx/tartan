import { readFileSync } from "node:fs";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { Client } from "pg";
import { expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20261125210000_reconcile_kettlebell_guides/migration.sql", import.meta.url),
  "utf8",
);

it("publie le swing relu et conserve les réouvertures, personnalisations et copies privées", async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`
      CREATE TEMP TABLE exercises (
        id text PRIMARY KEY, catalog_key text, catalog_version integer, organization_id text,
        deleted_at timestamp, updated_at timestamp, guide jsonb
      );
      CREATE TEMP TABLE platform_settings (key text PRIMARY KEY, value jsonb);
    `);
    const oldLoad =
      "Indique la charge externe affichée en kg ; les valeurs de machines différentes ne sont pas directement comparables.";
    const goblet = EXERCISE_CATALOG.find((e) => e.catalogKey === "goblet-squat")!.guide;
    const swing = EXERCISE_CATALOG.find((e) => e.catalogKey === "kettlebell-swing")!.guide;
    const oldSwing = { ...swing, loadExplanation: oldLoad, technicalReview: "pending" };
    const oldGoblet = { ...goblet, loadExplanation: oldLoad, technicalReview: "approved" };
    await db.query(
      `INSERT INTO exercises (id, catalog_key, catalog_version, organization_id, deleted_at, guide) VALUES
         ('goblet','goblet-squat',5,NULL,NULL,$1),
         ('swing','kettlebell-swing',5,NULL,NULL,$2),
         ('private','kettlebell-swing',5,'club',NULL,$2),
         ('retired','kettlebell-swing',5,NULL,now(),$2),
         ('later','kettlebell-swing',6,NULL,NULL,$2),
         ('edited','kettlebell-swing',5,NULL,NULL,$3)`,
      [oldGoblet, oldSwing, { ...oldSwing, objective: "Consigne ajustée." }],
    );
    await db.query(`INSERT INTO platform_settings VALUES
      ('exerciseReview:goblet-squat:v5:text:v5','false'),
      ('exerciseReview:kettlebell-swing:v5:text:v5','false'),
      ('exerciseReview:kettlebell-swing:v5:motion:v2','true'),
      ('exerciseReview:kettlebell-swing:v5:image:v1','true')`);
    const apply = async () => {
      await db.query("UPDATE exercises SET updated_at = NULL");
      await db.query(migration);
      return (await db.query("SELECT id FROM exercises WHERE updated_at IS NOT NULL ORDER BY id")).rows.map(
        (r) => r.id,
      );
    };
    expect(await apply()).toEqual([]);
    await db.query(
      "UPDATE platform_settings SET value = 'true' WHERE key = 'exerciseReview:kettlebell-swing:v5:text:v5'",
    );
    await db.query("DELETE FROM platform_settings WHERE key = 'exerciseReview:goblet-squat:v5:text:v5'");
    expect(await apply()).toEqual(["goblet", "swing"]);
    expect(await apply()).toEqual([]);
    const { rows } = await db.query("SELECT id, guide FROM exercises ORDER BY id");
    expect(Object.fromEntries(rows.map(({ id, guide }) => [id, guide]))).toEqual({
      goblet: { ...goblet, technicalReview: "approved" },
      swing: { ...swing, technicalReview: "approved" },
      private: oldSwing,
      retired: oldSwing,
      later: oldSwing,
      edited: { ...oldSwing, objective: "Consigne ajustée." },
    });
  } finally {
    await db.end();
  }
});
