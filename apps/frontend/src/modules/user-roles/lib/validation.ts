import {
	companyEmail,
	displayName,
	SORT_FIELDS,
	sortQuery,
	searchTerm,
} from "@elineas/auth-contracts";
import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros del listado administrativo: paginación + filtro por usuario, rol o
// sistema (este último se resuelve en el backend mediante join con `role`, ya
// que la asignación no tiene systemId propio).
export const userRoleFiltersSchema = paginationQuerySchema.extend({
	userId: z.string().optional(),
	roleId: z.string().optional(),
	systemId: z.string().optional(),
	...sortQuery(SORT_FIELDS.userRoles),
	// Presentación: tabla paginada o tarjetas agrupadas por sistema / usuario.
	view: z.enum(["table", "systems", "users"]).optional(),
	// Transitorio: abre el diálogo "Asignar rol" con `userId` preseleccionado
	// (p. ej. desde el aviso tras crear un usuario) o, junto a `systemSlug`, con
	// ese sistema fijado (enlace directo desde un sistema externo). La página lo
	// consume y lo limpia. Acepta `true` (navegación interna) y `1`/`"1"` (un
	// enlace escrito a mano: `?assign=1` llega como número).
	assign: z
		.union([z.literal(true), z.literal(1), z.literal("1")])
		.transform(() => true as const)
		.optional(),
	// Transitorio: slug del sistema del enlace directo. La página lo resuelve a
	// `systemId` (filtro) y lo limpia; un slug desconocido o que el usuario no
	// administra avisa con un toast.
	systemSlug: z.string().optional(),
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
	roleIds: z.array(z.string()).min(1, "Selecciona al menos un rol"),
});

// Roles propios del usuario autenticado (no requiere admin), opcionalmente
// acotados a un sistema por su slug.
export const myUserRolesQuerySchema = z.object({
	systemSlug: z.string().optional(),
});

// Directorio de usuarios (solo lectura) con búsqueda en el servidor. Lo usan
// los selectores de usuario: los admins de sistema no pueden listar empleados.
export const userDirectoryFiltersSchema = z.object({
	search: searchTerm.optional(),
	userId: z.string().optional(),
	page: z.number().int().min(1).optional(),
	limit: z.number().int().min(1).max(100).optional(),
});

// Invitar a un usuario nuevo: el IS crea la cuenta y le envía el enlace para
// fijar su contraseña (quien invita nunca la ve ni la elige).
export const inviteUserSchema = z.object({
	name: displayName,
	email: companyEmail,
});
