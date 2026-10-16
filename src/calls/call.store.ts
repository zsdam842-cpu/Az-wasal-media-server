import { randomUUID } from "node:crypto";

import type {
  CallSession,
  CallStatus,
  CallType,
} from "./call.types.js";

export class CallStore {
  private readonly sessions =
    new Map<string, CallSession>();

  create(
    callerId: string,
    receiverId: string,
    type: CallType,
  ): CallSession {
    if (callerId === receiverId) {
      throw new Error(
        "CALL_SELF_NOT_ALLOWED",
      );
    }

    const session: CallSession = {
      callId: randomUUID(),
      callerId,
      receiverId,
      type,
      status: "ringing",
      createdAt: new Date(),
    };

    this.sessions.set(
      session.callId,
      session,
    );

    return session;
  }

  get(
    callId: string,
  ): CallSession | undefined {
    return this.sessions.get(callId);
  }

  getActiveForUser(
    userId: string,
  ): CallSession[] {
    return [
      ...this.sessions.values(),
    ].filter(
      (call) =>
        (call.status === "ringing" ||
          call.status === "accepted") &&
        (call.callerId === userId ||
          call.receiverId === userId),
    );
  }

  updateStatus(
    callId: string,
    status: CallStatus,
  ): CallSession | undefined {
    const session =
      this.sessions.get(callId);

    if (!session) {
      return undefined;
    }

    session.status = status;

    if (status === "accepted") {
      session.answeredAt =
        new Date();
    }

    if (
      status === "rejected" ||
      status === "ended" ||
      status === "missed"
    ) {
      session.endedAt =
        new Date();
    }

    return session;
  }

  delete(
    callId: string,
  ): boolean {
    return this.sessions.delete(
      callId,
    );
  }
}

export const callStore =
  new CallStore();
