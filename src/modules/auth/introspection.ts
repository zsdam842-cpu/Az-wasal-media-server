import { createHash } from "node:crypto";

/**
 * تحقق احتياطي من رموز الدخول الصادرة عن خادم الحسابات والرسائل.
 *
 * الخادمان يوقّعان الرموز بسرّين مختلفين (JWT_SECRET منفصل لكل خدمة)،
 * لذلك عند فشل التحقق المحلي نستعلم نقطة /api/users/me في خادم
 * الحسابات للتحقق من الرمز واستخراج معرّف المستخدم (sub).
 *
 * الأمان:
 * - الرمز لا يُسجَّل في أي سجل ولا يُخزَّن؛ تُحفظ نتيجة التحقق فقط
 *   (بصمة تجزئة للرمز + معرف المستخدم) لمدة قصيرة لتقليل الطلبات.
 * - يمكن تعطيل الآلية بضبط CORE_AUTH_VERIFY_URL على قيمة فارغة،
 *   أو توجيهها إلى عنوان آخر.
 */

const DEFAULT_VERIFY_URL =
  "https://az-wasal-server-production.up.railway.app/api/users/me";

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

const cache = new Map<
  string,
  { userId: string; expiresAt: number }
>();

function getVerifyUrl(): string {
  const configured = process.env.CORE_AUTH_VERIFY_URL;

  // القيمة الفارغة الصريحة تعطّل الآلية.
  if (configured === "") {
    return "";
  }

  return configured || DEFAULT_VERIFY_URL;
}

function cacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface RemoteVerification {
  userId: string;
}

/**
 * التحقق من الرمز عبر خادم الحسابات.
 * يعيد null عند فشل التحقق أو تعطل الاتصال (لا يرمي استثناء).
 */
export async function verifyTokenRemotely(
  token: string,
): Promise<RemoteVerification | null> {
  const verifyUrl = getVerifyUrl();

  if (!verifyUrl) {
    return null;
  }

  const key = cacheKey(token);
  const now = Date.now();

  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return { userId: cached.userId };
  }

  if (cached) {
    cache.delete(key);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    let response: Response;

    try {
      response = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      user?: { id?: unknown; code?: unknown };
    };

    const rawId = body?.user?.id ?? body?.user?.code;

    const userId =
      typeof rawId === "string" && rawId.trim()
        ? rawId.trim()
        : typeof rawId === "number"
          ? String(rawId)
          : "";

    if (!userId) {
      return null;
    }

    cache.set(key, {
      userId,
      expiresAt: now + CACHE_TTL_MS,
    });

    if (cache.size > 5000) {
      const oldest = cache.keys().next().value;

      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }

    return { userId };
  } catch {
    // خادم الحسابات غير متاح أو الرمز غير صالح: نعيد null فقط.
    return null;
  }
}
