import { Router } from "express";
import {
  getMessageByIdController,
  getMessagesController,
  sendMessageController
} from "./messages.controller.js";

const router = Router();

router.post("/", sendMessageController);
router.get("/conversation/:conversationId", getMessagesController);
router.get("/:id", getMessageByIdController);

export default router;
