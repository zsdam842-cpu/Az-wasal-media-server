
import {
  Request,
  Response,
} from "express";

import {
  createPrivateChat,
  getConversationById,
  getUserConversations,
} from "./conversations.service.js";

interface AuthRequest extends Request {
  userId?: string;
}

export async function listConversationsController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: "AUTH_REQUIRED",
      });
      return;
    }

    const conversations = await getUserConversations(
      req.userId,
    );

    res.status(200).json({
      conversations,
    });
  } catch {
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function createPrivateConversationController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: "AUTH_REQUIRED",
      });
      return;
    }

    const { wasalCode } = req.body;

    if (
      typeof wasalCode !== "string" ||
      !wasalCode.trim()
    ) {
      res.status(400).json({
        error: "WASAL_CODE_REQUIRED",
      });
      return;
    }

    const conversation = await createPrivateChat(
      req.userId,
      wasalCode,
    );

    res.status(201).json({
      conversation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "INVALID_WASAL_CODE") {
      res.status(400).json({ error: message });
      return;
    }

    if (message === "USER_NOT_FOUND") {
      res.status(404).json({ error: message });
      return;
    }

    if (message === "CANNOT_CHAT_WITH_SELF") {
      res.status(400).json({ error: message });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getConversationController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: "AUTH_REQUIRED",
      });
      return;
    }

    const conversationId = String(
      req.params.id ?? "",
    );

    if (!conversationId) {
      res.status(400).json({
        error: "CONVERSATION_ID_REQUIRED",
      });
      return;
    }

    const conversation = await getConversationById(
      conversationId,
      req.userId,
    );

    if (!conversation) {
      res.status(404).json({
        error: "CONVERSATION_NOT_FOUND",
      });
      return;
    }

    res.status(200).json({
      conversation,
    });
  } catch {
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}
