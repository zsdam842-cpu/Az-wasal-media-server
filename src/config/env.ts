import "dotenv/config";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/**
 * أصول CORS المسموح بها.
 * - غير مضبوط أو "*" → كل الأصول ("*").
 * - قائمة مفصولة بفواصل → قائمة صريحة.
 *
 * مهم: القيمة الفارغة كانت سابقًا تُنتج طلبًا بلا ترويسة
 * Access-Control-Allow-Origin إطلاقًا، فيفشل أي عميل ويب.
 */
function resolveCorsOrigin(): string | string[] {
  const raw = (process.env.CORS_ORIGIN ?? "").trim();

  if (raw === "" || raw === "*") {
    return "*";
  }

  const allowed = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return allowed.length > 0 ? allowed : "*";
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: getEnv("JWT_SECRET"),
  corsOrigin: resolveCorsOrigin(),
  databaseUrl: getEnv("DATABASE_URL")
};
