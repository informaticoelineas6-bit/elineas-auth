import type { z } from "zod";
import type { themeSchema } from "@/modules/common/lib/validation";

export type Theme = z.infer<typeof themeSchema>;

export type StatusResponse = { status: boolean };

export type Pagination = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};
