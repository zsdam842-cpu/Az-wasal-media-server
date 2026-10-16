import { describe, expect, it } from "vitest";
import http from "node:http";
import { createApp } from "../src/app.js";

describe("Wasal server", () => {
  it("returns healthy status", async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      server.close();
      throw new Error("SERVER_ADDRESS_UNAVAILABLE");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/health`
      );

      expect(response.status).toBe(200);

      expect(await response.json()).toEqual({
        status: "ok",
        service: "wasal-server"
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
