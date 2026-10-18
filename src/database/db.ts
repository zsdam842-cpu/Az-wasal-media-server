import { Pool } from "pg";
import { env } from "../config/env.js";

const caCertificate = process.env.DATABASE_CA_CERT
  ?.replace(/\\n/g, "\n")
  .trim();

const databaseOptions = caCertificate
  ? {
      ssl: {
        ca: caCertificate,
        rejectUnauthorized: true,
      },
    }
  : {};

export const db = new Pool({
  connectionString: env.databaseUrl,
  ...databaseOptions,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
