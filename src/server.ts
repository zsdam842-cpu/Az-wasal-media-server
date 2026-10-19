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
  // فحص اتصال قاعدة البيانات بحدّ زمني (5 ثوانٍ) وغير مُعطِّل:
  // الخادم يجب أن يستمع دائمًا، وتُبلَّغ الجهوزية الحقيقية من /health/db.
  // (تعليق الخادم هنا يعني توقف الخدمة عن الرد تمامًا إن تأخرت القاعدة.)
  try {
    await Promise.race([
      checkDatabaseConnection(),
      new Promise((resolve) => {
        const timer = setTimeout(resolve, 5_000);
        if (typeof timer.unref === "function") timer.unref();
      }),
    ]);
  } catch (error) {
    console.error(
      "Database connection check failed at startup:",
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR",
    );
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
