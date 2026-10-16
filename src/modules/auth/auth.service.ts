import { randomInt } from "node:crypto";

import { createAuthUser } from "./auth.repository.js";

import {
  createTokens,
  verifyRefreshToken,
} from "./tokens.js";

import {
  findUserByPhone,
  findUserByWasalCode,
} from "../users/users.repository.js";

import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
} from "./auth.types.js";

import { verifyPassword } from "./password.js";

const WASAL_CODE_LENGTH = 15;
const WASAL_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * إنشاء رمز وصال عشوائي من 15 حرفًا أو رقمًا.
 */
function generateWasalCode(): string {
  let code = "";

  for (let index = 0; index < WASAL_CODE_LENGTH; index++) {
    code += WASAL_CODE_ALPHABET[
      randomInt(0, WASAL_CODE_ALPHABET.length)
    ];
  }

  return code;
}

/**
 * البحث عن رمز غير مستخدم.
 * قيد UNIQUE في قاعدة البيانات يظل ضروريًا لمنع التكرار.
 */
async function createUniqueWasalCode(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const wasalCode = generateWasalCode();

    const existingUser = await findUserByWasalCode(wasalCode);

    if (!existingUser) {
      return wasalCode;
    }
  }

  throw new Error("WASAL_CODE_GENERATION_FAILED");
}

export async function register(
  input: RegisterInput,
): Promise<AuthResponse> {
  const displayName = input.displayName?.trim();

  if (!displayName) {
    throw new Error("DISPLAY_NAME_REQUIRED");
  }

  if (displayName.length > 80) {
    throw new Error("DISPLAY_NAME_TOO_LONG");
  }

  const wasalCode = await createUniqueWasalCode();

  const user = await createAuthUser(
    displayName,
    wasalCode,
  );

  const tokens = createTokens(user.id);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username,
      wasalCode: user.wasalCode,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
    tokens,
  };
}

/**
 * تسجيل الدخول للحسابات التي تستخدم الهاتف وكلمة المرور.
 */
export async function login(
  input: LoginInput,
): Promise<AuthResponse> {
  if (!input.phone || !input.password) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = await findUserByPhone(input.phone);

  if (!user || !user.passwordHash) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const validPassword = verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!validPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const tokens = createTokens(user.id);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username,
      wasalCode: user.wasalCode,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
    tokens,
  };
}

/**
 * تجديد accessToken وrefreshToken.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const payload = verifyRefreshToken(refreshToken);

  const tokens = createTokens(payload.userId);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
