import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { exportDatabaseSchema } from "../lib/validation.ts";
import { exportDatabase } from "../services/database.ts";

export const exportDatabaseFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(exportDatabaseSchema)
	.handler(({ data }) => exportDatabase(data));
