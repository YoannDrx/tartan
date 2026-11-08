import { readFileSync } from "node:fs";
import { Client } from "pg";
import { expect, it } from "vitest";

it("rapproche seulement les anciennes unités connues et garde les anciens clients compatibles", async () => {
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  try {
    await sql.query(`CREATE TEMP TABLE performances (id text, unit text, mark numeric);
      INSERT INTO performances VALUES ('chrono', 's', 12), ('metres', 'm', 6), ('centimetres', 'cm', 600), ('inconnu', 'points', 100);`);
    const migration = readFileSync(
      new URL("../prisma/migrations/20261108030000_performance_rules/migration.sql", import.meta.url),
      "utf8",
    );
    // La table temporaire reproduit les lignes anciennes. Les relations de déduplication sont éprouvées
    // sur le schéma complet par athletic-performance.test.ts et la réinitialisation des bases de test.
    await sql.query(migration.split('CREATE TABLE "performance_creations"')[0]!);
    const rows = (
      await sql.query("SELECT id, measurement_type, record_direction, version FROM performances ORDER BY id")
    ).rows;
    expect(rows).toEqual([
      { id: "centimetres", measurement_type: "distance", record_direction: "higher", version: 1 },
      { id: "chrono", measurement_type: "time", record_direction: "lower", version: 1 },
      { id: "inconnu", measurement_type: null, record_direction: null, version: 1 },
      { id: "metres", measurement_type: "distance", record_direction: "higher", version: 1 },
    ]);
    await sql.query("INSERT INTO performances(id, unit, mark) VALUES ('ancien_client', 's', 11)");
    await expect(
      sql.query(
        "UPDATE performances SET measurement_type = 'distance', record_direction = 'higher' WHERE id = 'chrono'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql.query("UPDATE performances SET record_direction = NULL WHERE id = 'chrono'"),
    ).rejects.toMatchObject({ code: "23514" });
    expect((await sql.query("SELECT count(*)::int AS count FROM performances")).rows[0].count).toBe(5);
  } finally {
    await sql.end();
  }
});
