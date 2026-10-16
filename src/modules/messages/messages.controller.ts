import { Request, Response } from "express";
import {
  getMessageById,
  getMessages,
  sendMessage
} from "./messages.service.js";

interface AuthRequest extends Request {
  userId?: string;
}

export async function sendMessageController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: "AUTH_REQUIRED"
      });
      return;
    }

    const {
      conversationId,
      type = "text",
      content,
      replyToId
    } = req.body;

    if (!conversationId) {
      res.status(400).json({
        error: "CONVERSATION_ID_REQUIRED"
      });
      return;
    }

    const message = await sendMessage(
      req.userId,
      String(conversationId),
      String(type),
      content == null ? null : String(content),
      replyToId == null ? null : String(replyToId)
    );

    res.status(201).json({
      message
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "NOT_CONVERSATION_MEMBER") {
      res.status(403).json({
        error: message
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR"
    });
  }
}

export async function getMessagesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: "AUTH_REQUIRED"
      });
      return;
    }

    const conversationId = String(
      req.params.conversationId ?? ""
    );

    if (!conversationId) {
      res.status(400).json({
        error: "CONVERSATION_ID_REQUIRED"
      });
      return;
    }

    const limit = Number(req.query.limit ?? 50);

    const messages = await getMessages(
      req.userId,
      conversationId,
      Number.isFinite(limit) ? limit : 50
    );

    res.status(200).json({
      messages
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "NOT_CONVERSATION_MEMBER") {
      res.status(403).json({
        error: message
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR"
    });
  }
}

export async function getMessageByIdController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        error: "AUTH_REQUIRED"
      });
      return;
    }

    const messageId = String(req.params.id ?? "");

    if (!messageId) {
      res.status(400).json({
        error: "MESSAGE_ID_REQUIRED"
      });
      return;
    }

    const message = await getMessageById(
      req.userId,
      messageId
    );

    res.status(200).json({
      message
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "MESSAGE_NOT_FOUND") {
      res.status(404).json({
        error: message
      });
      return;
    }

    if (message === "NOT_CONVERSATION_MEMBER") {
      res.status(403).json({
        error: message
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR"
    });
  }
}
