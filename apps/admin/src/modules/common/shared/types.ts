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

export type ListSearch = {
	search?: string;
	[key: string]: unknown;
};

export type ListControls = {
	search: string;
	onSearchChange: (value: string) => void;
	onPageChange: (page: number) => void;
	onLimitChange: (limit: number) => void;
	isFiltered: boolean;
};
