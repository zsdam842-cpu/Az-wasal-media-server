import { Request, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.js";

import {
  getCallHistory,
} from "../../calls/call.history.js";

/**
 * سجل مكالمات المستخدم الحقيقي من قاعدة البيانات.
 * يعيد القائمة بصيغة متوافقة مع تطبيق Android:
 * { ok: true, calls: [ { id, callerName, kind, direction, createdAt, ... } ] }
 */
export async function getMyCallsController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId =
      typeof (req as AuthRequest).userId === "string"
        ? (req as AuthRequest).userId!
        : "";

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "AUTH_REQUIRED",
      });
      return;
    }

    const rows = await getCallHistory(userId, 100);

    const calls = rows.map((row) => {
      const isCaller = row.callerId === userId;

      const otherName = isCaller
        ? row.receiverName
        : row.callerName;

      const otherCode = isCaller
        ? row.receiverCode
        : row.callerCode;

      // الحالة من منظور المستخدم الحالي:
      // صادرة إذا هو المتصل، واردة إذا هو المستقبِل،
      // فائتة إذا كانت ringing/missed وهو المستقبِل.
      const direction =
        row.status === "missed" && !isCaller
          ? "missed"
          : isCaller
            ? "outgoing"
            : "incoming";

      return {
        id: row.id,
        callId: row.callId,
        name:
          otherName ||
          otherCode ||
          "مستخدم وصال",
        kind: row.callType === "video" ? "video" : "audio",
        direction,
        status: row.status,
        createdAt: row.createdAt,
        answeredAt: row.answeredAt,
        endedAt: row.endedAt,
      };
    });

    res.status(200).json({
      ok: true,
      success: true,
      calls,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "CALLS_HISTORY_FAILED",
    });
  }
}
