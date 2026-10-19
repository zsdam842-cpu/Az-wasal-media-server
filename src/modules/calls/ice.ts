import { createHmac } from "node:crypto";

/*
 * إعداد ICE الذي يُمنح للعملاء قبل المكالمة. ثلاث حالات بالترتيب:
 *
 * 1) TURN_API_URL — مزوّد TURN مُدار يعيد قائمة iceServers جاهزة (مفتاح API).
 * 2) TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL — بيانات اعتماد ثابتة
 *    يعطيها مزوّد مُدار في لوحته (بلا سرّ مشترك ولا مفتاح API).
 * 3) TURN_URLS + TURN_SECRET — بيانات اعتماد مؤقتة بصيغة TURN REST API
 *    (HMAC-SHA1 بالسرّ المشترك مع خادم coturn).
 * 4) STUN فقط — عندما لا يُضبط أي مما سبق.
 *
 * كل الحالات تُرجع STUN أيضًا، وأي فشل في الحالة 1 ينزل للحالة 2 ثم 3.
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  ttlSeconds: number;
}

type FetchLike = typeof fetch;

const DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

const DEFAULT_TTL_SECONDS = 3600;
const MANAGED_CACHE_MS = 30 * 60 * 1000;
const MANAGED_TIMEOUT_MS = 5000;

interface ManagedCache {
  url: string;
  expiresAt: number;
  servers: IceServer[];
}

let managedCache: ManagedCache | null = null;

function splitList(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stunServer(): IceServer {
  const stunUrls = splitList(process.env.STUN_URLS);

  return {
    urls:
      stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS,
  };
}

function isValidIceServer(value: unknown): value is IceServer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { urls?: unknown };
  const urls = candidate.urls;

  return (
    typeof urls === "string" ||
    (Array.isArray(urls) &&
      urls.length > 0 &&
      urls.every((item) => typeof item === "string"))
  );
}

/** يقبل [ ... ] أو { iceServers: [ ... ] } كما يعيدها مقدّم الخدمة. */
function readIceServers(payload: unknown): IceServer[] {
  const list = Array.isArray(payload)
    ? payload
    : typeof payload === "object" &&
        payload !== null &&
        Array.isArray(
          (payload as { iceServers?: unknown }).iceServers,
        )
      ? ((payload as { iceServers: unknown[] })
          .iceServers as unknown[])
      : [];

  return list.filter(isValidIceServer);
}

async function fetchManagedIceServers(
  url: string,
  fetchImpl: FetchLike,
): Promise<IceServer[]> {
  const now = Date.now();

  if (
    managedCache &&
    managedCache.url === url &&
    managedCache.expiresAt > now
  ) {
    return managedCache.servers;
  }

  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(MANAGED_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`TURN_PROVIDER_HTTP_${response.status}`);
  }

  const servers = readIceServers(await response.json());

  if (servers.length === 0) {
    throw new Error("TURN_PROVIDER_EMPTY");
  }

  managedCache = {
    url,
    expiresAt: now + MANAGED_CACHE_MS,
    servers,
  };

  return servers;
}

function buildStaticServer(): IceServer | null {
  const turnUrls = splitList(process.env.TURN_URLS);
  const username = String(
    process.env.TURN_USERNAME ?? "",
  ).trim();
  const credential = String(
    process.env.TURN_CREDENTIAL ?? "",
  ).trim();

  if (
    turnUrls.length === 0 ||
    !username ||
    !credential
  ) {
    return null;
  }

  return { urls: turnUrls, username, credential };
}

function buildSharedSecretServer(
  userId: string,
  now: number,
): { server: IceServer; ttlSeconds: number } | null {
  const turnUrls = splitList(process.env.TURN_URLS);
  const turnSecret = String(
    process.env.TURN_SECRET ?? "",
  ).trim();

  if (turnUrls.length === 0 || !turnSecret) {
    return null;
  }

  const configuredTtl = Number(
    process.env.TURN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS,
  );

  const ttlSeconds =
    Number.isFinite(configuredTtl) && configuredTtl > 0
      ? Math.floor(configuredTtl)
      : DEFAULT_TTL_SECONDS;

  const username = `${Math.floor(now / 1000) + ttlSeconds}:${userId}`;

  const credential = createHmac("sha1", turnSecret)
    .update(username)
    .digest("base64");

  return {
    server: { urls: turnUrls, username, credential },
    ttlSeconds,
  };
}

/**
 * يبني قائمة ICE لمستخدم معيّن.
 * `now` و`fetchImpl` قابلان للتمرير لتسهيل الاختبار.
 */
export async function buildIceConfig(
  userId: string,
  now: number = Date.now(),
  fetchImpl: FetchLike = fetch,
): Promise<IceConfig> {
  const iceServers: IceServer[] = [stunServer()];

  const managedUrl = String(
    process.env.TURN_API_URL ?? "",
  ).trim();

  if (managedUrl) {
    try {
      const managed = await fetchManagedIceServers(
        managedUrl,
        fetchImpl,
      );

      return {
        iceServers: [...iceServers, ...managed],
        ttlSeconds: Math.floor(MANAGED_CACHE_MS / 1000),
      };
    } catch {
      // نتجاهل وننزل إلى السرّ المشترك ثم STUN.
    }
  }

  const staticServer = buildStaticServer();

  if (staticServer) {
    const configuredTtl = Number(
      process.env.TURN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS,
    );

    return {
      iceServers: [...iceServers, staticServer],
      ttlSeconds:
        Number.isFinite(configuredTtl) && configuredTtl > 0
          ? Math.floor(configuredTtl)
          : DEFAULT_TTL_SECONDS,
    };
  }

  const shared = buildSharedSecretServer(userId, now);

  if (shared) {
    return {
      iceServers: [...iceServers, shared.server],
      ttlSeconds: shared.ttlSeconds,
    };
  }

  return { iceServers, ttlSeconds: 0 };
}
