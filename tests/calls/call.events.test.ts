import { describe, expect, it } from "vitest";
import { CALL_EVENTS } from "../../src/calls/call.events.js";

describe("CALL_EVENTS", () => {
  it("defines the incoming call event", () => {
    expect(CALL_EVENTS.INCOMING).toBe("call:incoming");
  });

  it("defines the accept event", () => {
    expect(CALL_EVENTS.ACCEPT).toBe("call:accept");
  });

  it("defines the reject event", () => {
    expect(CALL_EVENTS.REJECT).toBe("call:reject");
  });

  it("defines the end event", () => {
    expect(CALL_EVENTS.END).toBe("call:end");
  });

  it("defines the WebRTC offer event", () => {
    expect(CALL_EVENTS.OFFER).toBe("call:offer");
  });

  it("defines the WebRTC answer event", () => {
    expect(CALL_EVENTS.ANSWER).toBe("call:answer");
  });

  it("defines the ICE candidate event", () => {
    expect(CALL_EVENTS.ICE_CANDIDATE).toBe(
      "call:ice-candidate",
    );
  });
});
