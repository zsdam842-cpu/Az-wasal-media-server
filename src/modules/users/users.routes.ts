
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";

import {
  getUserByIdController,
  getUserByPhoneController,
  getUserByUsernameController,
  getUserByWasalCodeController,
  updateMyDisplayNameController,
} from "./users.controller.js";

const router = Router();

router.put(
  "/me/display-name",
  requireAuth,
  updateMyDisplayNameController
);

router.get(
  "/search/phone",
  getUserByPhoneController
);

router.get(
  "/search/username",
  getUserByUsernameController
);

router.get(
  "/search/wasal-code",
  getUserByWasalCodeController
);

router.get(
  "/:id",
  getUserByIdController
);

export default router;
