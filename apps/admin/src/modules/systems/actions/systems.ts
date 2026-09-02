import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	createSystemSchema,
	systemFiltersSchema,
	updateSystemSchema,
} from "../lib/validation.ts";
import {
	createSystem,
	deleteSystem,
	getSystem,
	listSystems,
	updateSystem,
} from "../services/systems.ts";

export const listSystemsFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(systemFiltersSchema)
	.handler(({ data }) => listSystems(data));

export const getSystemFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => getSystem(data.id));

export const createSystemFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(createSystemSchema)
	.handler(({ data }) => createSystem(data));

export const updateSystemFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ body: updateSystemSchema }))
	.handler(({ data }) => updateSystem(data.id, data.body));

export const deleteSystemFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => deleteSystem(data.id));
