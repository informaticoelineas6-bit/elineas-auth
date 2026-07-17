import type { CountryCode } from "libphonenumber-js";
import type { z } from "zod";
import type {
	passwordSchema,
	themeSchema,
} from "@/modules/common/lib/validation";

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
export interface PasswordInputProps
	extends Omit<React.ComponentProps<"input">, "type"> {
	/** Muestra el botón para generar contraseña segura */
	showGenerator?: boolean;
	/** Muestra el indicador de fortaleza debajo del input */
	showStrength?: boolean;
	/** Longitud de la contraseña generada (default: 16) */
	generatorLength?: number;
	/** Callback cuando se genera una nueva contraseña */
	onGenerate?: (password: string) => void;
}

export type PasswordSchema = z.infer<typeof passwordSchema>;

export interface StrengthResult {
	valid: boolean;
	score: number; // 0–4
	label: string;
	color: string;
	width: string;
	errors: string[];
}

export interface PhoneInputProps
	extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
	value?: string;
	onChange?: (value: string) => void;
	/** País por defecto (ISO 3166-1 alpha-2) para el código internacional y el formateo. */
	defaultCountry?: CountryCode;
}
