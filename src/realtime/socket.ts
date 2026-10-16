import type { Server, Socket } from "socket.io";

import { verifyToken } from "../modules/auth/tokens.js";
import { isConversationMember } from "../modules/conversations/conversations.repository.js";
import { CALL_EVENTS } from "../calls/call.events.js";
import { callStore } from "../calls/call.store.js";

import type {
  CallAnswer,
  CallOffer,
  CallType,
  IceCandidate,
} from "../calls/call.types.js";

const CALL_RING_TIMEOUT_MS = 30_000;

const callTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

function clearCallTimer(callId: string): void {
  const timer = callTimers.get(callId);

  if (!timer) {
    return;
  }

  clearTimeout(timer);
  callTimers.delete(callId);
}

function scheduleMissedCall(
  io: Server,
  callId: string,
): void {
  clearCallTimer(callId);

  const timer = setTimeout(() => {
    const call = callStore.get(callId);

    if (!call) {
      callTimers.delete(callId);
      return;
    }

    if (call.status !== "ringing") {
      callTimers.delete(callId);
      return;
    }

    const missedCall = callStore.updateStatus(
      callId,
      "missed",
    );

    if (!missedCall) {
      callTimers.delete(callId);
      return;
    }

    const payload = {
      callId: missedCall.callId,
      userId: "system",
      reason: "missed",
    };

    io.to(`user:${missedCall.callerId}`).emit(
      CALL_EVENTS.END,
      payload,
    );

    io.to(`user:${missedCall.receiverId}`).emit(
      CALL_EVENTS.END,
      payload,
    );

    callStore.delete(callId);
    callTimers.delete(callId);
  }, CALL_RING_TIMEOUT_MS);

  callTimers.set(callId, timer);
}

function getUserId(
  socket: Socket,
): string | undefined {
  return socket.data.userId as string | undefined;
}

function isCallParticipant(
  callId: string,
  userId: string,
): boolean {
  const call = callStore.get(callId);

  if (!call) {
    return false;
  }

  return (
    call.callerId === userId ||
    call.receiverId === userId
  );
}

export function setupSocket(io: Server): void {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (
        typeof token !== "string" ||
        token.length === 0
      ) {
        next(new Error("AUTH_REQUIRED"));
        return;
      }

      const payload = verifyToken(token);

      if (!payload?.userId) {
        next(new Error("INVALID_TOKEN"));
        return;
      }

      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    const userId = getUserId(socket);

    if (!userId) {
      socket.disconnect();
      return;
    }

    socket.join(`user:${userId}`);

    socket.on(
      "conversation:join",
      async (conversationId: string) => {
        if (
          typeof conversationId !== "string" ||
          conversationId.length === 0
        ) {
          return;
        }

        try {
          const member =
            await isConversationMember(
              conversationId,
              userId,
            );

          if (!member) {
            return;
          }

          socket.join(
            `conversation:${conversationId}`,
          );
        } catch {
          return;
        }
      },
    );

    socket.on(
      "conversation:leave",
      (conversationId: string) => {
        if (
          typeof conversationId !== "string" ||
          conversationId.length === 0
        ) {
          return;
        }

        socket.leave(
          `conversation:${conversationId}`,
        );
      },
    );

    socket.on(
      "message:send",
      async (payload: {
        conversationId: string;
        message: unknown;
      }) => {
        if (
          !payload ||
          typeof payload.conversationId !==
            "string"
        ) {
          return;
        }

        try {
          const member =
            await isConversationMember(
              payload.conversationId,
              userId,
            );

          if (!member) {
            return;
          }

          io
            .to(
              `conversation:${payload.conversationId}`,
            )
            .emit(
              "message:new",
              payload.message,
            );
        } catch {
          return;
        }
      },
    );

    socket.on(
      "typing:start",
      async (conversationId: string) => {
        if (
          typeof conversationId !== "string" ||
          conversationId.length === 0
        ) {
          return;
        }

        try {
          const member =
            await isConversationMember(
              conversationId,
              userId,
            );

          if (!member) {
            return;
          }

          socket
            .to(`conversation:${conversationId}`)
            .emit("typing:start", {
              userId,
              conversationId,
            });
        } catch {
          return;
        }
      },
    );

    socket.on(
      "typing:stop",
      async (conversationId: string) => {
        if (
          typeof conversationId !== "string" ||
          conversationId.length === 0
        ) {
          return;
        }

        try {
          const member =
            await isConversationMember(
              conversationId,
              userId,
            );

          if (!member) {
            return;
          }

          socket
            .to(`conversation:${conversationId}`)
            .emit("typing:stop", {
              userId,
              conversationId,
            });
        } catch {
          return;
        }
      },
    );

    socket.on(
      "call:start",
      (payload: {
        receiverId: string;
        type: CallType;
      }) => {
        if (
          !payload ||
          typeof payload.receiverId !== "string" ||
          (payload.type !== "audio" &&
            payload.type !== "video")
        ) {
          return;
        }

        if (payload.receiverId === userId) {
          return;
        }

        const call = callStore.create(
          userId,
          payload.receiverId,
          payload.type,
        );

        const callPayload = {
          callId: call.callId,
          callerId: call.callerId,
          receiverId: call.receiverId,
          type: call.type,
          status: call.status,
        };

        io.to(`user:${call.callerId}`).emit(
          CALL_EVENTS.STARTED,
          callPayload,
        );

        io.to(`user:${call.receiverId}`).emit(
          CALL_EVENTS.INCOMING,
          callPayload,
        );

        scheduleMissedCall(
          io,
          call.callId,
        );
      },
    );

    socket.on(
      CALL_EVENTS.ACCEPT,
      (callId: string) => {
        if (typeof callId !== "string") {
          return;
        }

        const call = callStore.get(callId);

        if (
          !call ||
          call.receiverId !== userId ||
          call.status !== "ringing"
        ) {
          return;
        }

        clearCallTimer(callId);

        const acceptedCall =
          callStore.updateStatus(
            callId,
            "accepted",
          );

        if (!acceptedCall) {
          return;
        }

        io.to(
          `user:${acceptedCall.callerId}`,
        ).emit(
          CALL_EVENTS.ACCEPT,
          {
            callId: acceptedCall.callId,
            userId,
          },
        );
      },
    );

    socket.on(
      CALL_EVENTS.REJECT,
      (callId: string) => {
        if (typeof callId !== "string") {
          return;
        }

        const call = callStore.get(callId);

        if (
          !call ||
          call.receiverId !== userId ||
          call.status !== "ringing"
        ) {
          return;
        }

        clearCallTimer(callId);

        const rejectedCall =
          callStore.updateStatus(
            callId,
            "rejected",
          );

        if (!rejectedCall) {
          return;
        }

        io.to(
          `user:${rejectedCall.callerId}`,
        ).emit(
          CALL_EVENTS.REJECT,
          {
            callId: rejectedCall.callId,
            userId,
          },
        );

        callStore.delete(callId);
      },
    );

    socket.on(
      CALL_EVENTS.END,
      (callId: string) => {
        if (typeof callId !== "string") {
          return;
        }

        const call = callStore.get(callId);

        if (
          !call ||
          !isCallParticipant(callId, userId)
        ) {
          return;
        }

        clearCallTimer(callId);

        const endedCall =
          callStore.updateStatus(
            callId,
            "ended",
          );

        if (!endedCall) {
          return;
        }

        const otherUserId =
          endedCall.callerId === userId
            ? endedCall.receiverId
            : endedCall.callerId;

        io.to(`user:${otherUserId}`).emit(
          CALL_EVENTS.END,
          {
            callId: endedCall.callId,
            userId,
            reason: "ended",
          },
        );

        callStore.delete(callId);
      },
    );

    socket.on(
      CALL_EVENTS.OFFER,
      (payload: CallOffer) => {
        if (
          !payload ||
          typeof payload.callId !== "string" ||
          typeof payload.callerId !== "string" ||
          typeof payload.receiverId !== "string" ||
          (payload.type !== "audio" &&
            payload.type !== "video") ||
          !payload.offer
        ) {
          return;
        }

        const call = callStore.get(
          payload.callId,
        );

        if (
          !call ||
          call.status !== "accepted" ||
          call.callerId !== userId ||
          call.callerId !== payload.callerId ||
          call.receiverId !== payload.receiverId ||
          call.type !== payload.type
        ) {
          return;
        }

        io.to(`user:${call.receiverId}`).emit(
          CALL_EVENTS.OFFER,
          payload,
        );
      },
    );

    socket.on(
      CALL_EVENTS.ANSWER,
      (payload: CallAnswer) => {
        if (
          !payload ||
          typeof payload.callId !== "string" ||
          !payload.answer
        ) {
          return;
        }

        const call = callStore.get(
          payload.callId,
        );

        if (
          !call ||
          call.status !== "accepted" ||
          call.receiverId !== userId
        ) {
          return;
        }

        io.to(`user:${call.callerId}`).emit(
          CALL_EVENTS.ANSWER,
          payload,
        );
      },
    );

    socket.on(
      CALL_EVENTS.ICE_CANDIDATE,
      (payload: IceCandidate) => {
        if (
          !payload ||
          typeof payload.callId !== "string" ||
          !payload.candidate
        ) {
          return;
        }

        const call = callStore.get(
          payload.callId,
        );

        if (
          !call ||
          call.status !== "accepted" ||
          !isCallParticipant(
            payload.callId,
            userId,
          )
        ) {
          return;
        }

        const otherUserId =
          call.callerId === userId
            ? call.receiverId
            : call.callerId;

        io.to(`user:${otherUserId}`).emit(
          CALL_EVENTS.ICE_CANDIDATE,
          payload,
        );
      },
    );

    socket.on("disconnect", () => {
      const activeCalls =
        callStore.getActiveForUser(userId);

      for (const call of activeCalls) {
        clearCallTimer(call.callId);

        const endedCall =
          callStore.updateStatus(
            call.callId,
            "ended",
          );

        if (!endedCall) {
          continue;
        }

        const otherUserId =
          endedCall.callerId === userId
            ? endedCall.receiverId
            : endedCall.callerId;

        io.to(`user:${otherUserId}`).emit(
          CALL_EVENTS.END,
          {
            callId: endedCall.callId,
            userId,
            reason: "disconnect",
          },
        );

        callStore.delete(call.callId);
      }
    });
  });
}
