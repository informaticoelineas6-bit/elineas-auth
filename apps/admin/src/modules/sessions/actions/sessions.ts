import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { revokeSessionSchema, sessionFiltersSchema } from "../lib/validation.ts";
import {
	adminRevokeSession,
	getCurrentSession,
	listAllSessions,
	listSessions,
	revokeAllSessions,
	revokeOtherSessions,
} from "../services/sessions.ts";

export const listSessionsFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.handler(() => listSessions());

export const getCurrentSessionFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.handler(() => getCurrentSession());

export const revokeAllSessionsFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.handler(() => revokeAllSessions());

export const revokeOtherSessionsFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.handler(() => revokeOtherSessions());

export const listAllSessionsFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(sessionFiltersSchema)
	.handler(({ data }) => listAllSessions(data));

export const adminRevokeSessionFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(revokeSessionSchema)
	.handler(({ data }) => adminRevokeSession(data.sessionId));
