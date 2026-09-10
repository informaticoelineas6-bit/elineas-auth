import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type { revokeSessionSchema, sessionFiltersSchema } from "../lib/validation.ts";

// Sesión SIN el token (`SafeSession` del IS): el token es un secreto de portador
// y nunca se expone en listados. Las fechas llegan como string ISO en JSON.
export type SafeSession = {
	id: string;
	userId: string;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	ipAddress?: string | null;
	userAgent?: string | null;
	impersonatedBy?: string | null;
	activeOrganizationId?: string | null;
};

export type SessionListResponse = {
	sessions: SafeSession[];
};

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;

// Sesión + datos mínimos del usuario dueño (listado administrativo: todas las
// sesiones, de todos los usuarios). `system` es a qué sistema pertenece la
// sesión (ver session-system.service.ts en el IS); `null` si nunca se enlazó.
export type AdminSafeSession = SafeSession & {
	user: { id: string; name: string; email: string };
	system: { id: string; name: string; slug: string } | null;
};

export type AdminSessionListResponse = {
	sessions: AdminSafeSession[];
	pagination: Pagination;
};

export type SessionFilters = z.input<typeof sessionFiltersSchema>;
