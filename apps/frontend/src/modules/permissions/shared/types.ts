import type { z } from "zod";
import type { System } from "#/modules/systems/shared/types.ts";
import type {
	assignPermissionSchema,
	updatePermissionSchema,
} from "../lib/validation.ts";

// Reexportado desde @elineas/auth-contracts: es el mismo tipo que usa
// cualquier otro frontend cliente del IS, no algo propio de este panel.
export type { MyPermission } from "@elineas/auth-contracts";

export type PermissionRole = {
	id: string;
	name: string;
};

// Permiso del catálogo tal como aparece dentro de la card de un sistema:
// además de resource/action/description trae los roles de ESE sistema que
// lo tienen asignado (GET /api/permissions/by-system).
export type SystemPermission = {
	id: string;
	resource: string;
	action: string;
	description: string | null;
	createdAt: string;
	roles: PermissionRole[];
};

export type SystemPermissions = {
	system: System;
	permissions: SystemPermission[];
};

export type AssignPermissionInput = z.infer<typeof assignPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
