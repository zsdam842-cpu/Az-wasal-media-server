import { Router } from "express";

import {
  createPrivateConversationController,
  getConversationController,
  listConversationsController,
} from "./conversations.controller.js";

const router = Router();

// جلب قائمة محادثات المستخدم الحالي
router.get("/", listConversationsController);

// إنشاء محادثة خاصة باستخدام رمز وصال
router.post("/", createPrivateConversationController);

// جلب محادثة بواسطة المعرّف
router.get("/:id", getConversationController);

export default router;
