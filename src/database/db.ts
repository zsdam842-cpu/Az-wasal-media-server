import { Pool } from "pg";
import { env } from "../config/env.js";

const caCertificate = process.env.DATABASE_CA_CERT;

if (!caCertificate) {
  throw new Error(
    "Missing required environment variable: DATABASE_CA_CERT"
  );
}

function getConnectionString(): string {
  const url = new URL(env.databaseUrl);

  // إزالة خيارات SSL من الرابط حتى لا تتعارض
  // مع شهادة المرجع المصدق التي نحددها أدناه.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");

  return url.toString();
}

export const db = new Pool({
  connectionString: getConnectionString(),

  // التحقق من شهادة Aiven بصورة آمنة.
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true
  },

  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
