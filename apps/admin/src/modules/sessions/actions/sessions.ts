import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { revokeSessionSchema } from "../lib/validation.ts";
import {
	listSessions,
	revokeAllSessions,
	revokeOtherSessions,
	revokeSession,
} from "../services/sessions.ts";

export const listSessionsFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.handler(() => listSessions());

export const revokeAllSessionsFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.handler(() => revokeAllSessions());

export const revokeOtherSessionsFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.handler(() => revokeOtherSessions());

export const revokeSessionFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(revokeSessionSchema)
	.handler(({ data }) => revokeSession(data.sessionId));
