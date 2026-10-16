import {
  NextFunction,
  Request,
  Response,
} from "express";

import { verifyToken } from "../modules/auth/tokens.js";

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

  try {
    const payload =
      verifyToken(token);

    if (
      !payload ||
      typeof payload.userId !== "string" ||
      payload.userId.length === 0
    ) {
      res.status(401).json({
        success: false,
        error: "INVALID_OR_EXPIRED_TOKEN",
      });
      return;
    }

    req.userId = payload.userId;

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "INVALID_OR_EXPIRED_TOKEN",
    });
  }
}
