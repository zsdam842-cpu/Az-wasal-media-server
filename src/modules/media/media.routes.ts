import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import {
  uploadMedia,
  downloadMedia,
} from "./media.controller.js";

import { requireAuth } from "../../middleware/auth.js";

const router = Router();

const uploadDir = path.resolve("uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "application/pdf",
  "application/zip",
  "application/octet-stream",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "");

    const filename =
      `${Date.now()}-${randomUUID()}` +
      extension;

    cb(null, filename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }

    cb(null, true);
  },
});

router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  uploadMedia,
);

router.get(
  "/:filename",
  requireAuth,
  downloadMedia,
);

export default router;
