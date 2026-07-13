// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import { env } from "@/config/env";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/auth-schema.ts", "./src/db/business-schema.ts"],
  out: "./src/db/migrations",
  dbCredentials: { url: env.DATABASE_URL! },
});
