import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type {
	createRoleSchema,
	roleFiltersSchema,
	updateRoleSchema,
} from "../lib/validation.ts";

export type Role = {
	id: string;
	systemId: string;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
};

export type RoleListResponse = {
	roles: Role[];
	pagination: Pagination;
};

export type RoleFilters = z.input<typeof roleFiltersSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
