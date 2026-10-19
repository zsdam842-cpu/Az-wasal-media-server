import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/*
 * تخزين كلمات المرور:
 * - التجزئة الجديدة تستخدم scrypt مع ملح عشوائي لكل كلمة مرور
 *   (scrypt$<salt-hex>$<key-hex>) بدل SHA-256 المجرّد بلا ملح.
 * - التحقق يدعم أيضًا التجزئات القديمة (SHA-256 بلا ملح) حتى لا تتعطل
 *   الحسابات القائمة، ثم يُستحسن ترقيتها عند أول تسجيل دخول ناجح.
 */

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_LENGTH = 64;
const LEGACY_SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function sha256Hex(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const actual = Buffer.from(a, "utf8");
  const expected = Buffer.from(b, "utf8");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

/**
 * ينشئ تجزئة آمنة لكلمة المرور (scrypt + ملح عشوائي).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH);

  return [
    SCRYPT_PREFIX,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

/**
 * يتحقق من كلمة المرور مقابل تجزئة مخزّنة.
 * يدعم صيغة scrypt الجديدة وصيغة SHA-256 القديمة للتوافق.
 */
export function verifyPassword(
  password: string,
  passwordHash: string,
): boolean {
  if (typeof passwordHash !== "string" || !passwordHash) {
    return false;
  }

  if (passwordHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const parts = passwordHash.split("$");

    if (parts.length !== 3) {
      return false;
    }

    const [, saltHex, keyHex] = parts;

    if (!saltHex || !keyHex) {
      return false;
    }

    try {
      const salt = Buffer.from(saltHex, "hex");
      const expectedKey = Buffer.from(keyHex, "hex");

      if (salt.length === 0 || expectedKey.length === 0) {
        return false;
      }

      const derivedKey = scryptSync(
        password,
        salt,
        expectedKey.length,
      );

      return timingSafeEqual(derivedKey, expectedKey);
    } catch {
      return false;
    }
  }

  // توافق مع التجزئات القديمة (SHA-256 بلا ملح).
  if (LEGACY_SHA256_PATTERN.test(passwordHash)) {
    return safeEqualHex(
      sha256Hex(password),
      passwordHash.toLowerCase(),
    );
  }

  return false;
}
