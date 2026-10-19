import { describe, expect, it } from "vitest";
import http from "node:http";
import { createApp } from "../src/app.js";

async function withServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
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
    await run(`http://127.0.0.1:${address.port}`);
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
}

describe("Wasal server", () => {
  it("returns healthy status", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);

      expect(await response.json()).toEqual({
        status: "ok",
        service: "wasal-server"
      });
    });
  });

  it("answers CORS preflight with an allow-origin header", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://wasal-client.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type"
        }
      });

      expect(
        response.headers.get("access-control-allow-origin")
      ).toBeTruthy();
    });
  });

  it("reports real database readiness", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/db`);
      const body = (await response.json()) as {
        database?: string;
      };

      expect([200, 503]).toContain(response.status);
      expect(typeof body.database).toBe("string");
    });
  });
});

