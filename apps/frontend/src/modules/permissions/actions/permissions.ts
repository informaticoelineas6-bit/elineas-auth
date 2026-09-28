import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	assignPermissionSchema,
	updatePermissionSchema,
} from "../lib/validation.ts";
import {
	assignPermission,
	assignPermissionToRole,
	listPermissionsBySystem,
	removePermissionFromSystem,
	unassignPermissionFromRole,
	updatePermission,
} from "../services/permissions.ts";

export const listPermissionsBySystemFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.handler(() => listPermissionsBySystem());

export const assignPermissionFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(assignPermissionSchema)
	.handler(({ data }) => assignPermission(data));

export const updatePermissionFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ body: updatePermissionSchema }))
	.handler(({ data }) => updatePermission(data.id, data.body));

export const removePermissionFromSystemFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ systemId: idSchema.shape.id }))
	.handler(({ data }) => removePermissionFromSystem(data.id, data.systemId));

export const assignPermissionToRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ roleId: idSchema.shape.id }))
	.handler(({ data }) => assignPermissionToRole(data.id, data.roleId));

export const unassignPermissionFromRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ roleId: idSchema.shape.id }))
	.handler(({ data }) => unassignPermissionFromRole(data.id, data.roleId));
