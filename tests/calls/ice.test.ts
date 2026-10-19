import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIceConfig } from "../../src/modules/calls/ice.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function clearTurnEnv(): void {
  delete process.env.TURN_API_URL;
  delete process.env.TURN_URLS;
  delete process.env.TURN_SECRET;
  delete process.env.TURN_TTL_SECONDS;
  delete process.env.STUN_URLS;
}

describe("ICE configuration", () => {
  it("returns STUN only when no TURN source is configured", async () => {
    clearTurnEnv();

    const config = await buildIceConfig("42");

    expect(config.ttlSeconds).toBe(0);
    expect(config.iceServers).toHaveLength(1);
    expect(config.iceServers[0].credential).toBeUndefined();
    expect(config.iceServers[0].urls).toContain(
      "stun:stun.l.google.com:19302",
    );
  });

  it("returns STUN only when only the URLs are set", async () => {
    clearTurnEnv();
    process.env.TURN_URLS = "turn:turn.example.com:3478";

    const config = await buildIceConfig("42");

    expect(config.iceServers).toHaveLength(1);
    expect(config.ttlSeconds).toBe(0);
  });

  it("signs time-limited TURN credentials with the shared secret", async () => {
    clearTurnEnv();
    process.env.TURN_URLS =
      "turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349";
    process.env.TURN_SECRET = "shared-secret";
    process.env.TURN_TTL_SECONDS = "600";

    const now = 1_700_000_000_000;
    const config = await buildIceConfig("7", now);

    const turn = config.iceServers.find((server) =>
      JSON.stringify(server.urls).includes("turn:"),
    );

    expect(turn).toBeDefined();
    expect(config.ttlSeconds).toBe(600);

    const expiry = Math.floor(now / 1000) + 600;
    const expectedUsername = `${expiry}:7`;

    expect(turn?.username).toBe(expectedUsername);
    expect(turn?.credential).toBe(
      createHmac("sha1", "shared-secret")
        .update(expectedUsername)
        .digest("base64"),
    );
  });

  it("uses a managed TURN provider when TURN_API_URL is set", async () => {
    clearTurnEnv();
    process.env.TURN_API_URL =
      "https://app.metered.live/api/v1/turn/credentials?apiKey=key";

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          urls: "turn:relay.example.com:80",
          username: "managed-user",
          credential: "managed-secret",
        },
      ],
    })) as unknown as typeof fetch;

    const config = await buildIceConfig(
      "42",
      Date.now(),
      fetchImpl,
    );

    expect(config.iceServers).toHaveLength(2);
    expect(config.iceServers[1].username).toBe(
      "managed-user",
    );
    expect(config.ttlSeconds).toBeGreaterThan(0);
  });

  it("caches managed credentials between calls", async () => {
    clearTurnEnv();
    process.env.TURN_API_URL =
      "https://app2.metered.live/api/v1/turn/credentials?apiKey=key";

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        iceServers: [{ urls: "turn:relay.example.com:443" }],
      }),
    })) as unknown as typeof fetch;

    await buildIceConfig("42", Date.now(), fetchImpl);
    await buildIceConfig("43", Date.now(), fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to shared secret, then to STUN, when the provider fails", async () => {
    clearTurnEnv();
    process.env.TURN_API_URL = "https://app3.metered.live/broken";
    process.env.TURN_URLS = "turn:turn.example.com:3478";
    process.env.TURN_SECRET = "shared-secret";

    const failingFetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const config = await buildIceConfig(
      "42",
      Date.now(),
      failingFetch,
    );

    expect(
      JSON.stringify(config.iceServers),
    ).toContain("turn:turn.example.com:3478");
    expect(config.ttlSeconds).toBe(3600);
  });
});

describe("static TURN credentials", () => {
  it("serves provider-issued username/password credentials", async () => {
    clearTurnEnv();
    process.env.TURN_URLS =
      "turn:global.relay.example.com:80,turn:global.relay.example.com:443";
    process.env.TURN_USERNAME = "provider-user";
    process.env.TURN_CREDENTIAL = "provider-pass";

    const config = await buildIceConfig("9");

    const turn = config.iceServers[1];

    expect(turn.username).toBe("provider-user");
    expect(turn.credential).toBe("provider-pass");
    expect(turn.urls).toContain(
      "turn:global.relay.example.com:80",
    );
    expect(config.ttlSeconds).toBe(3600);
  });

  it("ignores incomplete static credentials", async () => {
    clearTurnEnv();
    process.env.TURN_URLS = "turn:global.relay.example.com:80";
    process.env.TURN_USERNAME = "provider-user";

    const config = await buildIceConfig("9");

    expect(config.iceServers).toHaveLength(1);
    expect(config.ttlSeconds).toBe(0);
  });
});
