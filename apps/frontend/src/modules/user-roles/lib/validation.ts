import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros del listado administrativo: paginación + filtro por usuario, rol o
// sistema (este último se resuelve en el backend mediante join con `role`, ya
// que la asignación no tiene systemId propio).
export const userRoleFiltersSchema = paginationQuerySchema.extend({
	userId: z.string().optional(),
	roleId: z.string().optional(),
	systemId: z.string().optional(),
});

export const createUserRoleSchema = z.object({
	userId: z.string().min(1).max(100),
	roleId: z.string().min(1).max(100),
});

// Esquema del formulario "Asignar rol" (solo cliente). Incluye `systemId`, que
// no se envía al IS: solo sirve para acotar el select de rol al sistema elegido.
export const assignUserRoleFormSchema = z.object({
	userId: z.string().min(1, "Selecciona un usuario"),
	systemId: z.string().min(1, "Selecciona un sistema"),
	roleId: z.string().min(1, "Selecciona un rol"),
});

// Roles propios del usuario autenticado (no requiere admin), opcionalmente
// acotados a un sistema por su slug.
export const myUserRolesQuerySchema = z.object({
	systemSlug: z.string().optional(),
});
