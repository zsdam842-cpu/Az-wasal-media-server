import type {
  NextFunction,
  Request,
  Response,
} from "express";

/*
 * محدِّد طلبات بسيط في الذاكرة (بلا اعتماديات خارجية).
 * الغرض: حماية نقاط الدخول والتسجيل والرفع من إساءة الاستخدام
 * والهجمات البدائية (تخمين كلمات المرور، إغراق الطلبات).
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
}

export function rateLimit({
  windowMs,
  max,
  name,
}: RateLimitOptions) {
  const buckets = new Map<string, number[]>();

  const cleanup = setInterval(() => {
    const now = Date.now();

    for (const [key, times] of buckets.entries()) {
      const kept = times.filter((time) => now - time < windowMs);

      if (kept.length === 0) {
        buckets.delete(key);
      } else {
        buckets.set(key, kept);
      }
    }
  }, Math.max(windowMs, 30_000));

  if (typeof cleanup.unref === "function") {
    cleanup.unref();
  }

  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const key = `${name}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    const times = (buckets.get(key) ?? []).filter(
      (time) => now - time < windowMs,
    );

    times.push(now);
    buckets.set(key, times);

    if (times.length > max) {
      res.status(429).json({
        success: false,
        error: "RATE_LIMITED",
      });
      return;
    }

    next();
  };
}

export const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  name: "register",
});

export const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  name: "login",
});

export const refreshLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  name: "refresh",
});

export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  name: "upload",
});
