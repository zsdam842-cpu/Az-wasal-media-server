import "dotenv/config";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: getEnv("JWT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: getEnv("DATABASE_URL")
};
