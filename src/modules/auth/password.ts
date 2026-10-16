import { createHash, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

export function verifyPassword(
  password: string,
  passwordHash: string
): boolean {
  const actual = Buffer.from(hashPassword(password), "utf8");
  const expected = Buffer.from(passwordHash, "utf8");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
