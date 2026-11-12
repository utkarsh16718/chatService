import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const config = {
  DATABASE_URL: databaseUrl,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  PORT: port,
};
