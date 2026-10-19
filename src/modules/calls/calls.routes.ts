import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";

import {
  getIceServersController,
  getMyCallsController,
} from "./calls.controller.js";

const router = Router();

// إعداد STUN/TURN للمكالمات (بيانات اعتماد مؤقتة لكل مستخدم).
router.get(
  "/ice-servers",
  requireAuth,
  getIceServersController,
);

router.get(
  "/",
  requireAuth,
  getMyCallsController,
);

export default router;
