
import { db } from "../../database/db.js";

export interface User {
  id: string;
  phone: string | null;
  username: string | null;
  wasalCode: string;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  phone: string | null;
  username: string | null;
  wasal_code: string;
  display_name: string;
  avatar_url: string | null;
  password_hash: string | null;
  is_online: boolean;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    username: row.username,
    wasalCode: row.wasal_code,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    passwordHash: row.password_hash,
    isOnline: row.is_online,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserById(
  id: string
): Promise<User | null> {
  const result = await db.query<UserRow>(
    `
      SELECT
        id, phone, username, wasal_code,
        display_name, avatar_url, password_hash,
        is_online, last_seen_at, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows.length ? mapUser(result.rows[0]) : null;
}

export async function updateUserDisplayName(
  id: string,
  displayName: string
): Promise<User | null> {
  const result = await db.query<UserRow>(
    `
      UPDATE users
      SET display_name = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, phone, username, wasal_code,
        display_name, avatar_url, password_hash,
        is_online, last_seen_at, created_at, updated_at
    `,
    [id, displayName]
  );

  return result.rows.length ? mapUser(result.rows[0]) : null;
}

export async function findUserByPhone(
  phone: string
): Promise<User | null> {
  const result = await db.query<UserRow>(
    `
      SELECT
        id, phone, username, wasal_code,
        display_name, avatar_url, password_hash,
        is_online, last_seen_at, created_at, updated_at
      FROM users
      WHERE phone = $1
      LIMIT 1
    `,
    [phone]
  );

  return result.rows.length ? mapUser(result.rows[0]) : null;
}

export async function findUserByUsername(
  username: string
): Promise<User | null> {
  const result = await db.query<UserRow>(
    `
      SELECT
        id, phone, username, wasal_code,
        display_name, avatar_url, password_hash,
        is_online, last_seen_at, created_at, updated_at
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  );

  return result.rows.length ? mapUser(result.rows[0]) : null;
}

export async function findUserByWasalCode(
  wasalCode: string
): Promise<User | null> {
  const result = await db.query<UserRow>(
    `
      SELECT
        id, phone, username, wasal_code,
        display_name, avatar_url, password_hash,
        is_online, last_seen_at, created_at, updated_at
      FROM users
      WHERE wasal_code = $1
      LIMIT 1
    `,
    [wasalCode]
  );

  return result.rows.length ? mapUser(result.rows[0]) : null;
}
