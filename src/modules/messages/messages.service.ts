import {
  createMessage,
  findMessageById,
  listMessages
} from "./messages.repository.js";
import { checkConversationMember } from "../conversations/conversations.service.js";

export async function sendMessage(
  userId: string,
  conversationId: string,
  type: string,
  content: string | null,
  replyToId: string | null = null
) {
  const isMember = await checkConversationMember(
    conversationId,
    userId
  );

  if (!isMember) {
    throw new Error("NOT_CONVERSATION_MEMBER");
  }

  return createMessage(
    conversationId,
    userId,
    type,
    content,
    replyToId
  );
}

export async function getMessages(
  userId: string,
  conversationId: string,
  limit = 50
) {
  const isMember = await checkConversationMember(
    conversationId,
    userId
  );

  if (!isMember) {
    throw new Error("NOT_CONVERSATION_MEMBER");
  }

  return listMessages(conversationId, limit);
}

export async function getMessageById(
  userId: string,
  messageId: string
) {
  const message = await findMessageById(messageId);

  if (!message) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  const isMember = await checkConversationMember(
    message.conversationId,
    userId
  );

  if (!isMember) {
    throw new Error("NOT_CONVERSATION_MEMBER");
  }

  return message;
}
