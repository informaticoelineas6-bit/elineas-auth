import type { z } from "zod";
import type { revokeSessionSchema } from "../lib/validation.ts";

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
