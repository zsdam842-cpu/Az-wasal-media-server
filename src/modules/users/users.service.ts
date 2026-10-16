
import {
  findUserById,
  findUserByPhone,
  findUserByUsername,
  findUserByWasalCode,
  updateUserDisplayName,
} from "./users.repository.js";

export async function getUserById(id: string) {
  return findUserById(id);
}

export async function getUserByPhone(phone: string) {
  return findUserByPhone(phone);
}

export async function getUserByUsername(username: string) {
  return findUserByUsername(username);
}

export async function getUserByWasalCode(wasalCode: string) {
  return findUserByWasalCode(wasalCode);
}

export async function updateMyDisplayName(
  userId: string,
  displayName: string
) {
  const cleanName = displayName.trim();

  if (!cleanName) {
    throw new Error("DISPLAY_NAME_REQUIRED");
  }

  if (cleanName.length > 40) {
    throw new Error("DISPLAY_NAME_TOO_LONG");
  }

  return updateUserDisplayName(userId, cleanName);
}
