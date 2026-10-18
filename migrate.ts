
import fs from "node:fs";
import path from "node:path";
import { db } from "./src/database/db.js";

const migrations = [
  {
    id: "001_initial_schema",
    file: "001_initial_schema.sql",
  },
  {
    id: "002_enforce_15_char_wasal_code",
    file: "002_enforce_15_char_wasal_code.sql",
    legacyIds: [
      "002_expand_wasal_code",
      "003_enforce_15_char_wasal_code",
    ],
  },
  {
    id: "003_allow_legacy_and_new_wasal_codes",
    file: "003_allow_legacy_and_new_wasal_codes.sql",
  },
  {
    id: "004_enforce_15_char_wasal_code",
    file: "004_enforce_15_char_wasal_code.sql",
  },
  {
    id: "005_call_logs",
    file: "005_call_logs.sql",
  },
];

const expectedTables = [
  "users",
  "conversations",
  "conversation_members",
  "messages",
  "message_attachments",
  "message_reactions",
  "message_reads",
  "sticker_packs",
  "stickers",
  "sticker_favorites",
  "calls",
  "call_participants",
  "call_logs",
  "polls",
  "poll_options",
  "poll_votes",
  "events",
  "user_blocks",
  "favorites",
  "pinned_messages",
];

async function migrate(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _wasal_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const baseline = await db.query(`
    SELECT to_regclass('public.users') AS users_table
  `);

  const initial = await db.query(
    "SELECT id FROM _wasal_migrations WHERE id = $1",
    ["001_initial_schema"],
  );

  const usersTableExists =
    baseline.rows[0]?.users_table !== null &&
    baseline.rows[0]?.users_table !== undefined;

  if (initial.rows.length === 0 && usersTableExists) {
    const tables = await db.query(
      `
        SELECT table_name
        FROM unnest($1::text[]) AS expected(table_name)
        WHERE to_regclass('public.' || expected.table_name) IS NULL
      `,
      [expectedTables],
    );

    const missingTables = tables.rows.map(
      (row: { table_name: string }) => row.table_name,
    );

    if (missingTables.length > 0) {
      throw new Error(
        "Existing users table is missing required tables: " +
          missingTables.join(", ") +
          ". Initial schema was not run.",
      );
    }

    await db.query(
      "INSERT INTO _wasal_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING",
      ["001_initial_schema"],
    );

    console.log("Existing schema detected; initial migration marked.");
  }

  for (const migration of migrations) {
    const result = await db.query(
      "SELECT id FROM _wasal_migrations WHERE id = $1",
      [migration.id],
    );

    if (result.rows.length > 0) {
      console.log(`Migration already applied: ${migration.id}`);
      continue;
    }

    if ("legacyIds" in migration) {
      const legacyResult = await db.query(
        "SELECT id FROM _wasal_migrations WHERE id = ANY($1::text[])",
        [migration.legacyIds],
      );

      const constraintResult = await db.query(`
        SELECT pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'users'
          AND c.conname = 'users_wasal_code_format'
          AND c.contype = 'c'
      `);

      const definition =
        constraintResult.rows[0]?.definition ?? "";

      const hasExact15CharacterConstraint =
        definition.includes("^[A-Za-z0-9]{15}$");

      if (
        legacyResult.rows.length > 0 &&
        hasExact15CharacterConstraint
      ) {
        await db.query(
          "INSERT INTO _wasal_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING",
          [migration.id],
        );

        console.log(
          "Existing 15-character constraint detected; unified migration marked.",
        );
        continue;
      }
    }

    const migrationPath = path.join(
      process.cwd(),
      "migrations",
      migration.file,
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);

      await client.query(
        "INSERT INTO _wasal_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING",
        [migration.id],
      );

      await client.query("COMMIT");

      console.log(`Migration applied: ${migration.id}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Database migrations completed successfully.");
}

migrate()
  .catch((error) => {
    console.error("Database migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
