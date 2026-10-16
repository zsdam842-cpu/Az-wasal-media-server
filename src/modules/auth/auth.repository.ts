import { db } from "../../database/db.js";
import type { User } from "../users/users.repository.js";

export async function createAuthUser(
  displayName: string,
  wasalCode: string
): Promise<User> {
  const result = await db.query<User>(
    `
      INSERT INTO users (
        display_name,
        wasal_code
      )
      VALUES ($1, $2)
      RETURNING
        id,
        phone,
        username,
        wasal_code AS "wasalCode",
        display_name AS "displayName",
        avatar_url AS "avatarUrl",
        password_hash AS "passwordHash",
        is_online AS "isOnline",
        last_seen_at AS "lastSeenAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [
      displayName,
      wasalCode,
    ]
  );

  return result.rows[0];
}
