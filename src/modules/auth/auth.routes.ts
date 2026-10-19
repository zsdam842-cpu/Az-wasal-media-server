import { Router } from "express";

import {
  registerController,
  loginController,
  refreshController,
} from "./auth.controller.js";

import {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from "../../middleware/rateLimit.js";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  registerController,
);

router.post(
  "/login",
  loginLimiter,
  loginController,
);

router.post(
  "/refresh",
  refreshLimiter,
  refreshController,
);

export default router;
