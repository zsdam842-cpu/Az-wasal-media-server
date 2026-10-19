import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  hashPassword,
  verifyPassword,
} from "../../src/modules/auth/password.js";

describe("password hashing", () => {
  it("hashes with a per-password salt (scrypt)", () => {
    const first = hashPassword("same-password");
    const second = hashPassword("same-password");

    expect(first.startsWith("scrypt$")).toBe(true);
    expect(first).not.toEqual(second);
  });

  it("verifies a scrypt hash", () => {
    const hash = hashPassword("correct horse");

    expect(verifyPassword("correct horse", hash)).toBe(true);
    expect(verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("still verifies legacy unsalted SHA-256 hashes", () => {
    const legacy = createHash("sha256")
      .update("legacy-password", "utf8")
      .digest("hex");

    expect(verifyPassword("legacy-password", legacy)).toBe(true);
    expect(verifyPassword("other", legacy)).toBe(false);
  });

  it("rejects malformed or empty stored hashes", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "scrypt$broken")).toBe(false);
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
