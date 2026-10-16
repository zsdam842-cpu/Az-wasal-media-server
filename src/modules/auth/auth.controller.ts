import {
  Request,
  Response,
} from "express";

import {
  register,
  login,
  refreshAccessToken,
} from "./auth.service.js";

export async function registerController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body ?? {};

    const rawDisplayName =
      body.displayName ??
      body.display_name ??
      body.name;

    const displayName =
      typeof rawDisplayName === "string" &&
      rawDisplayName.trim()
        ? rawDisplayName.trim()
        : "مستخدم وصال";

    const result = await register({
      displayName,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    // يظهر السبب الحقيقي في سجلات الخادم فقط.
    console.error("Wasal account registration failed:", error);

    if (message === "DISPLAY_NAME_REQUIRED") {
      res.status(400).json({
        success: false,
        error: message,
      });
      return;
    }

    if (message === "DISPLAY_NAME_TOO_LONG") {
      res.status(400).json({
        success: false,
        error: message,
      });
      return;
    }

    if (message === "WASAL_CODE_GENERATION_FAILED") {
      res.status(503).json({
        success: false,
        error: message,
      });
      return;
    }

    if (
      message.includes("duplicate key") ||
      message.includes("unique constraint")
    ) {
      res.status(409).json({
        success: false,
        error: "ACCOUNT_CONFLICT",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "ACCOUNT_CREATION_FAILED",
    });
  }
}

export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { phone, password } = req.body ?? {};

    if (
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !phone ||
      !password
    ) {
      res.status(400).json({
        success: false,
        error: "PHONE_PASSWORD_REQUIRED",
      });
      return;
    }

    const result = await login({
      phone,
      password,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "INVALID_CREDENTIALS") {
      res.status(401).json({
        success: false,
        error: "INVALID_CREDENTIALS",
      });
      return;
    }

    console.error("Wasal login failed:", error);

    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function refreshController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { refreshToken } = req.body ?? {};

    if (
      typeof refreshToken !== "string" ||
      !refreshToken
    ) {
      res.status(400).json({
        success: false,
        error: "REFRESH_TOKEN_REQUIRED",
      });
      return;
    }

    const result = await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Wasal token refresh failed:", error);

    res.status(401).json({
      success: false,
      error: "INVALID_OR_EXPIRED_REFRESH_TOKEN",
    });
  }
}
