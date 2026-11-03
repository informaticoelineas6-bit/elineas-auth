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
	url: string | null;
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

export type ServiceKeyStatus = { hasKey: boolean; createdAt: string | null };
// `key` solo viene en la respuesta de generar/rotar: no se puede volver a leer.
export type ServiceKeyCreated = { key: string; createdAt: string };
