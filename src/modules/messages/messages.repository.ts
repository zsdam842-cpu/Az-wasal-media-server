import { db } from "../../database/db.js";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string | null;
  status: string;
  replyToId: string | null;
  forwardedFromId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  content: string | null;
  status: string;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  edited_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    type: row.type,
    content: row.content,
    status: row.status,
    replyToId: row.reply_to_id,
    forwardedFromId: row.forwarded_from_id,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  type: string,
  content: string | null,
  replyToId: string | null = null
): Promise<Message> {
  const result = await db.query<MessageRow>(
    `
      INSERT INTO messages (
        conversation_id,
        sender_id,
        type,
        content,
        reply_to_id
      )
      VALUES ($1, $2, $3::message_type, $4, $5)
      RETURNING
        id,
        conversation_id,
        sender_id,
        type,
        content,
        status,
        reply_to_id,
        forwarded_from_id,
        edited_at,
        deleted_at,
        created_at,
        updated_at
    `,
    [
      conversationId,
      senderId,
      type,
      content,
      replyToId
    ]
  );

  return mapMessage(result.rows[0]);
}

export async function findMessageById(
  id: string
): Promise<Message | null> {
  const result = await db.query<MessageRow>(
    `
      SELECT
        id,
        conversation_id,
        sender_id,
        type,
        content,
        status,
        reply_to_id,
        forwarded_from_id,
        edited_at,
        deleted_at,
        created_at,
        updated_at
      FROM messages
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0]
    ? mapMessage(result.rows[0])
    : null;
}

export async function listMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const result = await db.query<MessageRow>(
    `
      SELECT
        id,
        conversation_id,
        sender_id,
        type,
        content,
        status,
        reply_to_id,
        forwarded_from_id,
        edited_at,
        deleted_at,
        created_at,
        updated_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [conversationId, safeLimit]
  );

  return result.rows.map(mapMessage);
}
