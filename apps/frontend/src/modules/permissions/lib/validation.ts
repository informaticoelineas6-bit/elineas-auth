import { z } from "zod";
import { idSchema } from "#/modules/common/lib/validation.ts";

// Mismos límites que valida el IS (ver AssignPermissionBodySchema /
// UpdatePermissionBodySchema en apps/backend/src/openapi/business.schemas.ts).
const resourceSchema = z
	.string()
	.min(1, "Debe tener al menos un caracter")
	.max(100, "Debe tener menos de 100 caracteres");

const actionSchema = z
	.string()
	.min(1, "Debe tener al menos un caracter")
	.max(100, "Debe tener menos de 100 caracteres");

const descriptionSchema = z
	.string()
	.max(500, "Debe tener menos de 500 caracteres");

export const assignPermissionSchema = z.object({
	systemId: idSchema.shape.id,
	roleId: idSchema.shape.id,
	resource: resourceSchema,
	action: actionSchema,
	description: descriptionSchema.optional(),
});

export const updatePermissionSchema = z.object({
	resource: resourceSchema.optional(),
	action: actionSchema.optional(),
	description: descriptionSchema.optional(),
});

// Esquema de formulario (solo cliente) para crear/asignar un permiso: system y
// role son obligatorios (se elige con un select), description siempre
// presente (arranca en "") para calzar con el validador de TanStack Form.
export const assignPermissionFormSchema = z.object({
	systemId: z.string().min(1, "Selecciona un sistema"),
	roleId: z.string().min(1, "Selecciona un rol"),
	resource: resourceSchema,
	action: actionSchema,
	description: descriptionSchema,
});

// Edición: resource/action/description del catálogo (systemId/roleId no se
// editan aquí, se gestionan aparte con los toggles de rol).
export const updatePermissionFormSchema = z.object({
	resource: resourceSchema,
	action: actionSchema,
	description: descriptionSchema,
});
