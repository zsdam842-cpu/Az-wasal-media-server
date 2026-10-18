import { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";

const uploadDir = path.resolve("uploads");

function getMediaUrl(
  req: Request,
  filename: string,
): string {
  const host = req.get("host");

  if (!host) {
    throw new Error("MEDIA_HOST_REQUIRED");
  }

  const forwardedProto = req
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  // Railway يستضيف الخادم عبر HTTPS.
  const protocol =
    forwardedProto === "https" ||
    host.toLowerCase().endsWith(".up.railway.app")
      ? "https"
      : req.protocol === "https"
        ? "https"
        : "http";

  const encodedFilename = encodeURIComponent(filename);

  return `${protocol}://${host}/api/media/${encodedFilename}`;
}

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

  try {
    const mediaUrl = getMediaUrl(
      req,
      req.file.filename,
    );

    res.status(201).json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: mediaUrl,
    });
  } catch (error) {
    console.error(
      "Media URL generation failed:",
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR",
    );

    res.status(500).json({
      success: false,
      error: "MEDIA_URL_GENERATION_FAILED",
    });
  }
}

export function downloadMedia(
  req: Request,
  res: Response,
): void {
  const rawFilename = req.params.filename;

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

  const filename = path.basename(rawFilename);

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

  let stat: fs.Stats;

  try {
    stat = fs.statSync(filePath);
  } catch {
    res.status(404).json({
      success: false,
      error: "FILE_NOT_FOUND",
    });
    return;
  }

  if (!stat.isFile()) {
    res.status(404).json({
      success: false,
      error: "FILE_NOT_FOUND",
    });
    return;
  }

  res.sendFile(
    filePath,
    (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: "MEDIA_DOWNLOAD_FAILED",
        });
      }
    },
  );
}
