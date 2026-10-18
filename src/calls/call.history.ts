import { db } from "../database/db.js";

export interface CallLogRow {
  id: string;
  callId: string;
  callerId: string;
  callerCode: string | null;
  callerName: string | null;
  receiverId: string;
  receiverCode: string | null;
  receiverName: string | null;
  callType: "audio" | "video";
  status: "ringing" | "active" | "ended" | "rejected" | "missed";
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

interface CallLogDbRow {
  id: string;
  call_id: string;
  caller_id: string;
  caller_code: string | null;
  caller_name: string | null;
  receiver_id: string;
  receiver_code: string | null;
  receiver_name: string | null;
  call_type: string;
  status: string;
  created_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
}

function mapRow(row: CallLogDbRow): CallLogRow {
  return {
    id: row.id,
    callId: row.call_id,
    callerId: row.caller_id,
    callerCode: row.caller_code,
    callerName: row.caller_name,
    receiverId: row.receiver_id,
    receiverCode: row.receiver_code,
    receiverName: row.receiver_name,
    callType:
      row.call_type === "video" ? "video" : "audio",
    status: row.status as CallLogRow["status"],
    createdAt: row.created_at.toISOString(),
    answeredAt: row.answered_at
      ? row.answered_at.toISOString()
      : null,
    endedAt: row.ended_at
      ? row.ended_at.toISOString()
      : null,
  };
}

export async function insertCallLog(input: {
  callId: string;
  callerId: string;
  callerCode?: string | null;
  callerName?: string | null;
  receiverId: string;
  receiverCode?: string | null;
  receiverName?: string | null;
  callType: "audio" | "video";
}): Promise<void> {
  await db.query(
    `
    INSERT INTO call_logs
      (call_id, caller_id, caller_code, caller_name, receiver_id, receiver_code, receiver_name, call_type, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ringing')
    `,
    [
      input.callId,
      input.callerId,
      input.callerCode ?? null,
      input.callerName ?? null,
      input.receiverId,
      input.receiverCode ?? null,
      input.receiverName ?? null,
      input.callType,
    ],
  );
}

export async function updateCallLogStatus(
  callId: string,
  status: "active" | "ended" | "rejected" | "missed",
): Promise<void> {
  if (status === "active") {
    await db.query(
      `
      UPDATE call_logs
      SET status = 'active', answered_at = COALESCE(answered_at, NOW())
      WHERE call_id = $1
      `,
      [callId],
    );
    return;
  }

  await db.query(
    `
    UPDATE call_logs
    SET status = $2, ended_at = NOW()
    WHERE call_id = $1
    `,
    [callId, status],
  );
}

export async function getCallHistory(
  userId: string,
  limit = 100,
): Promise<CallLogRow[]> {
  const result = await db.query(
    `
    SELECT id, call_id, caller_id, caller_code, caller_name,
      receiver_id, receiver_code, receiver_name,
      call_type, status, created_at, answered_at, ended_at
    FROM call_logs
    WHERE caller_id = $1 OR receiver_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [userId, limit],
  );

  return result.rows.map(
    (row) => mapRow(row as unknown as CallLogDbRow),
  );
}
