import { readFileSync } from "node:fs";
import { Client } from "pg";
import { expect, it } from "vitest";

it("migre les validations anciennes sans rejouer les séances terminées ni modifier les partielles", async () => {
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  await sql.connect();
  try {
    // Table temporaire de cette connexion : aucune table métier n'est modifiée par cette reproduction.
    await sql.query(`CREATE TEMP TABLE session_logs (id text, status text, completed_at timestamp(3), created_at timestamp(3));
      INSERT INTO session_logs VALUES
      ('finished', 'done', '2026-01-02', '2026-01-01'),
      ('old', 'done', NULL, '2026-01-01'),
      ('partial', 'partial', '2026-01-02', '2026-01-01');`);
    await sql.query(
      readFileSync(
        new URL("../prisma/migrations/20261108020000_session_celebration/migration.sql", import.meta.url),
        "utf8",
      ),
    );
    const rows = (
      await sql.query(
        "SELECT id, to_char(celebration_claimed_at, 'YYYY-MM-DD') AS celebration_claimed_at FROM session_logs ORDER BY id",
      )
    ).rows;
    expect(rows).toEqual([
      { id: "finished", celebration_claimed_at: "2026-01-02" },
      { id: "old", celebration_claimed_at: "2026-01-01" },
      { id: "partial", celebration_claimed_at: null },
    ]);
  } finally {
    await sql.end();
  }
});
