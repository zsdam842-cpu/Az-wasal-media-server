import cors from "cors";
import express from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import conversationsRoutes from "./modules/conversations/conversations.routes.js";
import messagesRoutes from "./modules/messages/messages.routes.js";
import mediaRoutes from "./modules/media/media.routes.js";

import { requireAuth } from "./middleware/auth.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin:
        process.env.CORS_ORIGIN === "*"
          ? true
          : process.env.CORS_ORIGIN,
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
    requireAuth,
    (_req, res) => {
      res.status(200).json([]);
    },
  );

  app.use(
    "/api/media",
    mediaRoutes,
  );

  return app;
}
