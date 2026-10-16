import { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";

const uploadDir = path.resolve("uploads");

export function uploadMedia(
  req: Request,
  res: Response,
): void {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: "FILE_REQUIRED",
    });
    return;
  }

  res.status(201).json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `/api/media/${encodeURIComponent(
      req.file.filename,
    )}`,
  });
}

export function downloadMedia(
  req: Request,
  res: Response,
): void {
  const rawFilename =
    req.params.filename;

  if (
    typeof rawFilename !== "string" ||
    rawFilename.length === 0
  ) {
    res.status(400).json({
      success: false,
      error: "INVALID_FILENAME",
    });
    return;
  }

  const filename =
    path.basename(rawFilename);

  if (
    filename !== rawFilename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    res.status(400).json({
      success: false,
      error: "INVALID_FILENAME",
    });
    return;
  }

  const filePath = path.join(
    uploadDir,
    filename,
  );

  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      success: false,
      error: "FILE_NOT_FOUND",
    });
    return;
  }

  const stat =
    fs.statSync(filePath);

  if (!stat.isFile()) {
    res.status(404).json({
      success: false,
      error: "FILE_NOT_FOUND",
    });
    return;
  }

  res.sendFile(filePath);
}
