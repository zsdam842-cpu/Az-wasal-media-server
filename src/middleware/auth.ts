import {
  NextFunction,
  Request,
  Response,
} from "express";

import { verifyToken } from "../modules/auth/tokens.js";
import { verifyTokenRemotely } from "../modules/auth/introspection.js";

export interface AuthRequest
  extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    res.status(401).json({
      success: false,
      error: "AUTH_REQUIRED",
    });
    return;
  }

  const token = authorization
    .slice("Bearer ".length)
    .trim();

  if (!token) {
    res.status(401).json({
      success: false,
      error: "AUTH_REQUIRED",
    });
    return;
  }

  handleAuth(token, req, res, next);
}

function handleAuth(
  token: string,
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  // أولًا: التحقق المحلي برمز الخادم نفسه.
  try {
    const payload =
      verifyToken(token);

    if (
      payload &&
      typeof payload.userId ===
        "string" &&
      payload.userId.length > 0
    ) {
      req.userId = payload.userId;

      next();
      return;
    }
  } catch {
    // الرمز ليس موقّعًا بسرّ هذا الخادم:
    // نتابع بالتحقق الاحتياطي عبر خادم الحسابات.
  }

  // ثانيًا: التحقق عبر خادم الحسابات والرسائل
  // (رموز صادرة عنه بسرّ توقيع مختلف).
  verifyTokenRemotely(token)
    .then((remote) => {
      if (!remote) {
        res.status(401).json({
          success: false,
          error:
            "INVALID_OR_EXPIRED_TOKEN",
        });
        return;
      }

      req.userId = remote.userId;

      next();
    })
    .catch(() => {
      res.status(401).json({
        success: false,
        error:
          "INVALID_OR_EXPIRED_TOKEN",
      });
    });
}
