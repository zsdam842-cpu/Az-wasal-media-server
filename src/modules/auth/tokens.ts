import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import type { AuthTokens } from "./auth.types.js";

interface TokenPayload {
  userId: string;
  type?: "access" | "refresh";
}

type JwtPayloadObject = jwt.JwtPayload & {
  userId?: unknown;
  type?: unknown;
};

export function createTokens(
  userId: string,
): AuthTokens {
  const accessToken = jwt.sign(
    {
      userId,
      type: "access",
    },
    env.jwtSecret,
    {
      expiresIn: "15m",
    },
  );

  const refreshToken = jwt.sign(
    {
      userId,
      type: "refresh",
    },
    env.jwtSecret,
    {
      expiresIn: "30d",
    },
  );

  return {
    accessToken,
    refreshToken,
  };
}

function parseTokenPayload(
  token: string,
): TokenPayload {
  const decoded = jwt.verify(
    token,
    env.jwtSecret,
  );

  if (
    typeof decoded !== "object" ||
    decoded === null
  ) {
    throw new Error("INVALID_TOKEN");
  }

  const payload = decoded as JwtPayloadObject;

  /*
   * يدعم رموز خادم وصال الحالي:
   * sub: "123"
   *
   * ويدعم الرموز التي يستخدم فيها الخادم:
   * userId: "123"
   */
  const rawUserId =
    payload.userId ?? payload.sub;

  const userId =
    typeof rawUserId === "string"
      ? rawUserId
      : "";

  if (!userId) {
    throw new Error("INVALID_TOKEN");
  }

  /*
   * نسمح فقط بنوعي الرموز المعروفين.
   * الرموز القديمة التي لا تحتوي type
   * تظل مقبولة للتوافق مع الجلسات السابقة.
   */
  let type: "access" | "refresh" | undefined;

  if (payload.type === "access") {
    type = "access";
  } else if (payload.type === "refresh") {
    type = "refresh";
  } else if (payload.type === undefined) {
    type = undefined;
  } else {
    throw new Error("INVALID_TOKEN_TYPE");
  }

  return {
    userId,
    type,
  };
}

/**
 * يتحقق من رموز الدخول المستخدمة في الطلبات
 * المحمية واتصالات Socket.IO.
 *
 * يدعم userId وsub.
 * لا يقبل رمز التجديد بوصفه رمز دخول.
 */
export function verifyToken(
  token: string,
): { userId: string } {
  const payload =
    parseTokenPayload(token);

  if (payload.type === "refresh") {
    throw new Error("INVALID_ACCESS_TOKEN");
  }

  return {
    userId: payload.userId,
  };
}

/**
 * يتحقق من رموز التجديد فقط.
 */
export function verifyRefreshToken(
  token: string,
): { userId: string } {
  const payload =
    parseTokenPayload(token);

  if (payload.type === "access") {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  return {
    userId: payload.userId,
  };
}
