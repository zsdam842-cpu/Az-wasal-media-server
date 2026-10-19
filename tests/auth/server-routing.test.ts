import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTokenRemotely } from "../../src/modules/auth/introspection.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("account verification server routing", () => {
  it("verifies account tokens only at the approved core endpoint by default", async () => {
    vi.stubEnv("CORE_AUTH_VERIFY_URL", undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "routing-test-user" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTokenRemotely("routing-test-default-token")).toEqual({ userId: "routing-test-user" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://az-wasal-server-production.up.railway.app/api/users/me",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer routing-test-default-token" },
      }),
    );
  });

  it("preserves an explicitly disabled remote verification setting", async () => {
    vi.stubEnv("CORE_AUTH_VERIFY_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTokenRemotely("routing-test-disabled-token")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
