import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type {
	createSystemSchema,
	systemFiltersSchema,
	updateSystemSchema,
} from "../lib/validation.ts";

export type System = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
};

export type SystemListResponse = {
	systems: System[];
	pagination: Pagination;
};

export type SystemFilters = z.input<typeof systemFiltersSchema>;
export type CreateSystemInput = z.infer<typeof createSystemSchema>;
export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;
