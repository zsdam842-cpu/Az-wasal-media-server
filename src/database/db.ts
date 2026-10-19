import { Pool } from "pg";
import { env } from "../config/env.js";

/*
 * إعداد TLS لقاعدة البيانات.
 *
 * - DATABASE_SSL_STRICT=true (اختياري): تحقّق صارم من الشهادة، ويُستخدم
 *   فيها DATABASE_CA_CERT إن وُجد.
 * - الافتراضي: TLS مفعّل لكن بلا تحقّق من سلسلة الشهادة، لأن شهادات
 *   قواعد البيانات المُدارة (Railway وغيرها) موقّعة ذاتيًا.
 *   هذا ما يمنع خطأ SELF_SIGNED_CERT_IN_CHAIN الذي يُسقط الترحيل والتشغيل.
 * - sslmode=disable في الرابط: تعطيل TLS كليًا.
 *
 * ملاحظة: خيارات SSL في الرابط تُزال قبل تمريره لـ pg حتى لا تتعارض
 * مع الإعداد المُحدَّد هنا (وهو سبب شائع لتضارب التحقق).
 */

const caCertificate = process.env.DATABASE_CA_CERT
  ?.replace(/\\n/g, "\n")
  .trim();

const strictSsl =
  String(process.env.DATABASE_SSL_STRICT ?? "")
    .toLowerCase() === "true";

function withoutSslParams(url: string): string {
  try {
    const parsed = new URL(url);

    for (const key of [
      "sslmode",
      "sslrootcert",
      "sslcert",
      "sslkey",
    ]) {
      parsed.searchParams.delete(key);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

const sslDisabled = /sslmode=disable/i.test(
  env.databaseUrl,
);

// قاعدة بيانات محلية (تطوير أو اختبارات CI) لا تدعم TLS عادةً.
const isLocalHost =
  /@(localhost|127\.0\.0\.1|::1)([:/]|$)/i.test(
    env.databaseUrl,
  );

const useTls = !sslDisabled && !isLocalHost;

const databaseOptions = !useTls
  ? {}
  : {
      ssl:
        strictSsl && caCertificate
          ? {
              ca: caCertificate,
              rejectUnauthorized: true,
            }
          : {
              rejectUnauthorized: false,
            },
    };

export const db = new Pool({
  connectionString: useTls
    ? withoutSslParams(env.databaseUrl)
    : env.databaseUrl,
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
