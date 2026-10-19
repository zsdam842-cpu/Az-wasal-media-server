import cors from "cors";
import express from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import conversationsRoutes from "./modules/conversations/conversations.routes.js";
import messagesRoutes from "./modules/messages/messages.routes.js";
import mediaRoutes from "./modules/media/media.routes.js";
import callsRoutes from "./modules/calls/calls.routes.js";

import { requireAuth } from "./middleware/auth.js";
import { checkDatabaseConnection } from "./database/db.js";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
    }),
  );

  app.use(
    express.json({
      limit: "1mb",
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "wasal-server",
    });
  });

  // جهوزية حقيقية: تفشل (503) عندما لا تكون قاعدة البيانات متاحة،
  // حتى لا تُبقي منصة الاستضافة نسخة معطوبة في الخدمة.
  app.get("/health/db", async (_req, res) => {
    try {
      await checkDatabaseConnection();

      res.status(200).json({
        status: "ok",
        service: "wasal-server",
        database: "ok",
      });
    } catch {
      res.status(503).json({
        status: "error",
        service: "wasal-server",
        database: "error",
      });
    }
  });

  app.use(
    "/api/auth",
    authRoutes,
  );

  app.use(
    "/api/users",
    requireAuth,
    usersRoutes,
  );

  app.use(
    "/api/conversations",
    requireAuth,
    conversationsRoutes,
  );

  app.use(
    "/api/messages",
    requireAuth,
    messagesRoutes,
  );

  app.use(
    "/api/calls",
    callsRoutes,
  );

  app.use(
    "/api/media",
    mediaRoutes,
  );

  return app;
}
