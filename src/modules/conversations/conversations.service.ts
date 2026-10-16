
import {
  createPrivateConversation,
  findConversationById,
  isConversationMember,
  listUserConversations,
} from "./conversations.repository.js";

import {
  findUserByWasalCode,
} from "../users/users.repository.js";

const WASAL_CODE_REGEX = /^[A-Za-z0-9]{15}$/;

export async function getConversationById(
  id: string,
  userId: string,
) {
  const isMember = await isConversationMember(id, userId);

  if (!isMember) {
    return null;
  }

  return findConversationById(id);
}

export async function getUserConversations(
  userId: string,
) {
  return listUserConversations(userId);
}

export async function createPrivateChat(
  userId: string,
  wasalCode: string,
) {
  const normalizedCode = wasalCode.trim();

  if (!WASAL_CODE_REGEX.test(normalizedCode)) {
    throw new Error("INVALID_WASAL_CODE");
  }

  const otherUser = await findUserByWasalCode(
    normalizedCode,
  );

  if (!otherUser) {
    throw new Error("USER_NOT_FOUND");
  }

  if (userId === otherUser.id) {
    throw new Error("CANNOT_CHAT_WITH_SELF");
  }

  return createPrivateConversation(
    userId,
    otherUser.id,
  );
}

export async function checkConversationMember(
  conversationId: string,
  userId: string,
) {
  return isConversationMember(
    conversationId,
    userId,
  );
}
