import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";

vi.mock("../../src/modules/auth/tokens.js", () => ({
  verifyToken: vi.fn((token: string) => ({
    userId: token,
  })),
}));

import { setupSocket } from "../../src/realtime/socket.js";

describe("Socket call signaling", () => {
  let httpServer: HttpServer | undefined;
  let ioServer: Server | undefined;
  let caller: Socket | undefined;
  let receiver: Socket | undefined;
  let attacker: Socket | undefined;

  afterEach(async () => {
    vi.useRealTimers();

    caller?.disconnect();
    receiver?.disconnect();
    attacker?.disconnect();

    ioServer?.close();

    await new Promise<void>((resolve) => {
      if (!httpServer?.listening) {
        resolve();
        return;
      }

      httpServer.close(() => resolve());
    });

    caller = undefined;
    receiver = undefined;
    attacker = undefined;
    ioServer = undefined;
    httpServer = undefined;
  });

  async function createConnectedClients(): Promise<{
    caller: Socket;
    receiver: Socket;
  }> {
    httpServer = createServer();

    ioServer = new Server(httpServer, {
      transports: ["websocket"],
    });

    setupSocket(ioServer);

    await new Promise<void>((resolve) => {
      httpServer!.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();

    if (!address || typeof address === "string") {
      throw new Error("SERVER_ADDRESS_UNAVAILABLE");
    }

    const port = address.port;

    caller = createClient(`http://127.0.0.1:${port}`, {
      auth: {
        token: "caller-1",
      },
      transports: ["websocket"],
    });

    receiver = createClient(`http://127.0.0.1:${port}`, {
      auth: {
        token: "receiver-1",
      },
      transports: ["websocket"],
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        caller!.once("connect", () => resolve());
        caller!.once("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        receiver!.once("connect", () => resolve());
        receiver!.once("connect_error", reject);
      }),
    ]);

    return {
      caller,
      receiver,
    };
  }

  async function createAttacker(): Promise<Socket> {
    if (!httpServer) {
      throw new Error("SERVER_NOT_STARTED");
    }

    const address = httpServer.address();

    if (!address || typeof address === "string") {
      throw new Error("SERVER_ADDRESS_UNAVAILABLE");
    }

    attacker = createClient(
      `http://127.0.0.1:${address.port}`,
      {
        auth: {
          token: "attacker-1",
        },
        transports: ["websocket"],
      },
    );

    await new Promise<void>((resolve, reject) => {
      attacker!.once("connect", () => resolve());
      attacker!.once("connect_error", reject);
    });

    return attacker;
  }

  async function startAudioCall(): Promise<string> {
    const incomingCall = new Promise<{
      callId: string;
      callerId: string;
      receiverId: string;
      type: string;
      status: string;
    }>((resolve) => {
      receiver!.once("call:incoming", resolve);
    });

    caller!.emit("call:start", {
      receiverId: "receiver-1",
      type: "audio",
    });

    const call = await incomingCall;

    expect(call.callId).toBeTruthy();
    expect(call.callerId).toBe("caller-1");
    expect(call.receiverId).toBe("receiver-1");
    expect(call.type).toBe("audio");
    expect(call.status).toBe("ringing");

    return call.callId;
  }

  function expectNoEvent(
    socket: Socket,
    eventName: string,
    trigger: () => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let received = false;

      const handler = () => {
        received = true;
      };

      socket.once(eventName, handler);

      trigger();

      setTimeout(() => {
        socket.off(eventName, handler);

        if (received) {
          reject(
            new Error(
              `UNAUTHORIZED_EVENT_RECEIVED:${eventName}`,
            ),
          );
          return;
        }

        resolve();
      }, 150);
    });
  }

  it("sends an incoming call to the receiver", async () => {
    await createConnectedClients();

    await startAudioCall();
  });

  it("sends an incoming video call to the receiver", async () => {
    await createConnectedClients();

    const incomingCall = new Promise<{
      callId: string;
      callerId: string;
      receiverId: string;
      type: string;
      status: string;
    }>((resolve) => {
      receiver!.once("call:incoming", resolve);
    });

    caller!.emit("call:start", {
      receiverId: "receiver-1",
      type: "video",
    });

    const call = await incomingCall;

    expect(call.callId).toBeTruthy();
    expect(call.callerId).toBe("caller-1");
    expect(call.receiverId).toBe("receiver-1");
    expect(call.type).toBe("video");
    expect(call.status).toBe("ringing");
  });

  it("notifies the caller when the receiver accepts", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    const accepted = new Promise<{
      callId: string;
      userId: string;
    }>((resolve) => {
      caller!.once("call:accept", resolve);
    });

    receiver!.emit("call:accept", callId);

    const event = await accepted;

    expect(event.callId).toBe(callId);
    expect(event.userId).toBe("receiver-1");
  });

  it("notifies the caller when the receiver rejects", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    const rejected = new Promise<{
      callId: string;
      userId: string;
    }>((resolve) => {
      caller!.once("call:reject", resolve);
    });

    receiver!.emit("call:reject", callId);

    const event = await rejected;

    expect(event.callId).toBe(callId);
    expect(event.userId).toBe("receiver-1");
  });

  it("notifies the receiver when the caller ends the call", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    const ended = new Promise<{
      callId: string;
      userId: string;
    }>((resolve) => {
      receiver!.once("call:end", resolve);
    });

    caller!.emit("call:end", callId);

    const event = await ended;

    expect(event.callId).toBe(callId);
    expect(event.userId).toBe("caller-1");
  });

  it("forwards a WebRTC offer from the caller to the receiver", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    receiver!.emit("call:accept", callId);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 20),
    );

    const offerReceived = new Promise<{
      callId: string;
      callerId: string;
      receiverId: string;
      type: string;
      offer: {
        type: string;
        sdp: string;
      };
    }>((resolve) => {
      receiver!.once("call:offer", resolve);
    });

    caller!.emit("call:offer", {
      callId,
      callerId: "caller-1",
      receiverId: "receiver-1",
      type: "audio",
      offer: {
        type: "offer",
        sdp: "test-offer-sdp",
      },
    });

    const event = await offerReceived;

    expect(event.callId).toBe(callId);
    expect(event.callerId).toBe("caller-1");
    expect(event.receiverId).toBe("receiver-1");
    expect(event.type).toBe("audio");
    expect(event.offer.type).toBe("offer");
    expect(event.offer.sdp).toBe("test-offer-sdp");
  });

  it("forwards a WebRTC video offer from the caller to the receiver", async () => {
    await createConnectedClients();

    const incomingCall = new Promise<{
      callId: string;
      callerId: string;
      receiverId: string;
      type: string;
      status: string;
    }>((resolve) => {
      receiver!.once("call:incoming", resolve);
    });

    caller!.emit("call:start", {
      receiverId: "receiver-1",
      type: "video",
    });

    const call = await incomingCall;

    receiver!.emit("call:accept", call.callId);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 20),
    );

    const offerReceived = new Promise<{
      callId: string;
      callerId: string;
      receiverId: string;
      type: string;
      offer: {
        type: string;
        sdp: string;
      };
    }>((resolve) => {
      receiver!.once("call:offer", resolve);
    });

    caller!.emit("call:offer", {
      callId: call.callId,
      callerId: "caller-1",
      receiverId: "receiver-1",
      type: "video",
      offer: {
        type: "offer",
        sdp: "test-video-offer-sdp",
      },
    });

    const event = await offerReceived;

    expect(event.callId).toBe(call.callId);
    expect(event.callerId).toBe("caller-1");
    expect(event.receiverId).toBe("receiver-1");
    expect(event.type).toBe("video");
    expect(event.offer.type).toBe("offer");
    expect(event.offer.sdp).toBe("test-video-offer-sdp");
  });

  it("forwards a WebRTC answer from the receiver to the caller", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    receiver!.emit("call:accept", callId);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 20),
    );

    const answerReceived = new Promise<{
      callId: string;
      answer: {
        type: string;
        sdp: string;
      };
    }>((resolve) => {
      caller!.once("call:answer", resolve);
    });

    receiver!.emit("call:answer", {
      callId,
      answer: {
        type: "answer",
        sdp: "test-answer-sdp",
      },
    });

    const event = await answerReceived;

    expect(event.callId).toBe(callId);
    expect(event.answer.type).toBe("answer");
    expect(event.answer.sdp).toBe("test-answer-sdp");
  });

  it("forwards an ICE candidate to the other participant", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    receiver!.emit("call:accept", callId);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 20),
    );

    const candidateReceived = new Promise<{
      callId: string;
      candidate: {
        candidate: string;
        sdpMid: string;
        sdpMLineIndex: number;
      };
    }>((resolve) => {
      receiver!.once("call:ice-candidate", resolve);
    });

    caller!.emit("call:ice-candidate", {
      callId,
      candidate: {
        candidate: "candidate:test",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    });

    const event = await candidateReceived;

    expect(event.callId).toBe(callId);
    expect(event.candidate.candidate).toBe(
      "candidate:test",
    );
    expect(event.candidate.sdpMid).toBe("0");
    expect(event.candidate.sdpMLineIndex).toBe(0);
  });

  it("does not allow a different user to accept the call", async () => {
    await createConnectedClients();
    await createAttacker();

    const callId = await startAudioCall();

    await expectNoEvent(
      caller!,
      "call:accept",
      () => {
        attacker!.emit("call:accept", callId);
      },
    );
  });

  it("does not allow a different user to reject the call", async () => {
    await createConnectedClients();
    await createAttacker();

    const callId = await startAudioCall();

    await expectNoEvent(
      caller!,
      "call:reject",
      () => {
        attacker!.emit("call:reject", callId);
      },
    );
  });

  it("does not allow a different user to end the call", async () => {
    await createConnectedClients();
    await createAttacker();

    const callId = await startAudioCall();

    await expectNoEvent(
      receiver!,
      "call:end",
      () => {
        attacker!.emit("call:end", callId);
      },
    );
  });

  it("does not allow a different user to send a WebRTC offer", async () => {
    await createConnectedClients();
    await createAttacker();

    const callId = await startAudioCall();

    await expectNoEvent(
      receiver!,
      "call:offer",
      () => {
        attacker!.emit("call:offer", {
          callId,
          callerId: "attacker-1",
          receiverId: "receiver-1",
          type: "audio",
          offer: {
            type: "offer",
            sdp: "unauthorized-offer",
          },
        });
      },
    );
  });

  it("does not allow the caller to send a WebRTC answer", async () => {
    await createConnectedClients();

    const callId = await startAudioCall();

    await expectNoEvent(
      caller!,
      "call:answer",
      () => {
        caller!.emit("call:answer", {
          callId,
          answer: {
            type: "answer",
            sdp: "unauthorized-answer",
          },
        });
      },
    );
  });

  it("does not allow a different user to send an ICE candidate", async () => {
    await createConnectedClients();
    await createAttacker();

    const callId = await startAudioCall();

    await expectNoEvent(
      receiver!,
      "call:ice-candidate",
      () => {
        attacker!.emit("call:ice-candidate", {
          callId,
          candidate: {
            candidate: "unauthorized-candidate",
            sdpMid: "0",
            sdpMLineIndex: 0,
          },
        });
      },
    );
  });

  it(
    "marks an unanswered call as missed after the ringing timeout",
    async () => {
      await createConnectedClients();

      const incomingCall = new Promise<{
        callId: string;
        callerId: string;
        receiverId: string;
        type: string;
        status: string;
      }>((resolve) => {
        receiver!.once("call:incoming", resolve);
      });

      const missedCall = new Promise<{
        callId: string;
        userId: string;
      }>((resolve) => {
        caller!.once("call:end", resolve);
      });

      caller!.emit("call:start", {
        receiverId: "receiver-1",
        type: "audio",
      });

      const call = await incomingCall;

      expect(call.callId).toBeTruthy();
      expect(call.status).toBe("ringing");

      const missed = await missedCall;

      expect(missed.callId).toBe(call.callId);
      expect(missed.userId).toBe("system");
    },
    35000,
  );
});
