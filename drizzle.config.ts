// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { env } from "@/config/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: env.DATABASE_URL! },
});