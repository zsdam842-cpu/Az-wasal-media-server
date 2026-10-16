import {
  Request,
  Response,
} from "express";

import { AuthRequest } from "../../middleware/auth.js";

import {
  getUserById,
  getUserByPhone,
  getUserByUsername,
  getUserByWasalCode,
  updateMyDisplayName,
} from "./users.service.js";

const WASAL_CODE_REGEX = /^[A-Za-z0-9]{15}$/;

function toPublicUser(
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>
) {
  return {
    id: user.id,
    wasalCode: user.wasalCode,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserByIdController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = String(req.params.id ?? "").trim();

    if (!id) {
      res.status(400).json({ error: "USER_ID_REQUIRED" });
      return;
    }

    const user = await getUserById(id);

    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Get user by ID failed:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}

export async function getUserByPhoneController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const phone = String(req.query.phone ?? "").trim();

    if (!phone) {
      res.status(400).json({ error: "PHONE_REQUIRED" });
      return;
    }

    const user = await getUserByPhone(phone);

    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Search user by phone failed:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}

export async function getUserByUsernameController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const username = String(req.query.username ?? "").trim();

    if (!username) {
      res.status(400).json({ error: "USERNAME_REQUIRED" });
      return;
    }

    const user = await getUserByUsername(username);

    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Search user by username failed:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}

export async function getUserByWasalCodeController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const wasalCode = String(
      req.query.wasalCode ?? ""
    ).trim();

    if (!wasalCode) {
      res.status(400).json({ error: "WASAL_CODE_REQUIRED" });
      return;
    }

    if (!WASAL_CODE_REGEX.test(wasalCode)) {
      res.status(400).json({ error: "INVALID_WASAL_CODE" });
      return;
    }

    const user = await getUserByWasalCode(wasalCode);

    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Search user by Wasal code failed:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
}

export async function updateMyDisplayNameController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: "AUTH_REQUIRED",
    });
    return;
  }

  const rawName = req.body?.displayName;

  if (typeof rawName !== "string" || !rawName.trim()) {
    res.status(400).json({
      success: false,
      error: "DISPLAY_NAME_REQUIRED",
    });
    return;
  }

  const displayName = rawName.trim();

  if (displayName.length > 40) {
    res.status(400).json({
      success: false,
      error: "DISPLAY_NAME_TOO_LONG",
    });
    return;
  }

  try {
    const user = await updateMyDisplayName(
      userId,
      displayName
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error("Update display name failed:", error);

    res.status(500).json({
      success: false,
      error: "DISPLAY_NAME_UPDATE_FAILED",
    });
  }
}
