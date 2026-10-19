import http from "node:http";
import { Server } from "socket.io";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import {
  checkDatabaseConnection,
  db,
} from "./database/db.js";
import { setupSocket } from "./realtime/socket.js";

const app = createApp();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigin,
  },
});

setupSocket(io);

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  try {
    io.close();
  } catch {
    // نتجاهل أخطاء الإغلاق ونُكمل بقية الخطوات.
  }

  httpServer.close(() => {
    void db
      .end()
      .catch(() => {})
      .finally(() => {
        console.log("shutdown complete");
        process.exit(0);
      });
  });

  setTimeout(() => process.exit(0), 10_000).unref();
}

async function start(): Promise<void> {
  // لا نُشغّل الخادم إن كانت قاعدة البيانات غير متاحة:
  // بهذا لا يبقى في الخدمة بحالة غير سليمة.
  try {
    await checkDatabaseConnection();
  } catch (error) {
    console.error(
      "Database connection failed at startup:",
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR",
    );

    await db.end().catch(() => {});
    process.exit(1);
  }

  httpServer.listen(
    env.port,
    () => {
      console.log(
        `Wasal server running on port ${env.port}`,
      );
    },
  );
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

void start();
