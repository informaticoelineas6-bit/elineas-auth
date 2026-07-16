import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);

// Query de paginación compartida por todos los listados administrativos del IS
// (ver README del IS §10.2): `page` 1-indexado y `limit` acotado a [1, 100].
// z.coerce admite tanto el número que envía el cliente como su forma en string.
export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idSchema = z.object({ id: z.string().min(1) });
