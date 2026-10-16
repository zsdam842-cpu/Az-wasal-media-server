import { db } from "../../database/db.js";

export interface Conversation {
  id: string;
  type: "private" | "group";
  name: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserConversation extends Conversation {
  title: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastMessageAt: Date | null;
}

interface ConversationRow {
  id: string;
  type: "private" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface UserConversationRow extends ConversationRow {
  title: string | null;
  last_message: string | null;
  last_message_type: string | null;
  last_message_at: Date | null;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUserConversations(
  userId: string
): Promise<UserConversation[]> {
  const result = await db.query<UserConversationRow>(
    `
      SELECT
        c.id,
        c.type,
        c.name,
        c.avatar_url,
        c.created_by,
        c.created_at,
        c.updated_at,
        CASE
          WHEN c.type = 'group'
            THEN COALESCE(c.name, 'مجموعة')
          ELSE COALESCE(other_user.display_name, 'مستخدم وصال')
        END AS title,
        last_message.content AS last_message,
        last_message.type AS last_message_type,
        last_message.created_at AS last_message_at
      FROM conversations c
      INNER JOIN conversation_members mine
        ON mine.conversation_id = c.id
       AND mine.user_id = $1
      LEFT JOIN LATERAL (
        SELECT u.display_name
        FROM conversation_members other_member
        INNER JOIN users u
          ON u.id = other_member.user_id
        WHERE other_member.conversation_id = c.id
          AND other_member.user_id <> $1
          AND c.type = 'private'
        LIMIT 1
      ) other_user ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          m.content,
          m.type,
          m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) last_message ON TRUE
      ORDER BY
        COALESCE(last_message.created_at, c.updated_at) DESC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    ...mapConversation(row),
    title: row.title || row.name || "مستخدم وصال",
    lastMessage: row.last_message,
    lastMessageType: row.last_message_type,
    lastMessageAt: row.last_message_at,
  }));
}

export async function findConversationById(
  id: string
): Promise<Conversation | null> {
  const result = await db.query<ConversationRow>(
    `
      SELECT
        id,
        type,
        name,
        avatar_url,
        created_by,
        created_at,
        updated_at
      FROM conversations
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0]
    ? mapConversation(result.rows[0])
    : null;
}

export async function createPrivateConversation(
  userId: string,
  otherUserId: string
): Promise<Conversation> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<ConversationRow>(
      `
        SELECT
          c.id,
          c.type,
          c.name,
          c.avatar_url,
          c.created_by,
          c.created_at,
          c.updated_at
        FROM conversations c
        JOIN conversation_members cm1
          ON cm1.conversation_id = c.id
        JOIN conversation_members cm2
          ON cm2.conversation_id = c.id
        WHERE c.type = 'private'
          AND cm1.user_id = $1
          AND cm2.user_id = $2
        LIMIT 1
      `,
      [userId, otherUserId]
    );

    if (existing.rows[0]) {
      await client.query("COMMIT");
      return mapConversation(existing.rows[0]);
    }

    const conversationResult = await client.query<ConversationRow>(
      `
        INSERT INTO conversations (
          type,
          created_by
        )
        VALUES ('private', $1)
        RETURNING
          id,
          type,
          name,
          avatar_url,
          created_by,
          created_at,
          updated_at
      `,
      [userId]
    );

    const conversation = conversationResult.rows[0];

    await client.query(
      `
        INSERT INTO conversation_members (
          conversation_id,
          user_id
        )
        VALUES
          ($1, $2),
          ($1, $3)
      `,
      [conversation.id, userId, otherUserId]
    );

    await client.query("COMMIT");

    return mapConversation(conversation);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function isConversationMember(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.query(
    `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [conversationId, userId]
  );

  return result.rowCount === 1;
}
