import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";

import {
  getMyCallsController,
} from "./calls.controller.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  getMyCallsController,
);

export default router;
