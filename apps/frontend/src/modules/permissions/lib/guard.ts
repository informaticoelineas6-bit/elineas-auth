import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { canAccessResource, hasPermission } from "./access.ts";
import type { MyPermission } from "../shared/types.ts";

// Para usar en `beforeLoad` de una ruta admin-only o que exige un permiso
// concreto: si el usuario no puede acceder, CANCELA la navegación (redirect)
// en vez de dejarla completar y mostrar un estado "sin permisos" ya dentro de
// la página. Evita que alguien sin permiso llegue a ver el layout, las
// queries en pending o el flash de la página antes del 403 de la API.
//
// `resource: undefined` = admin-only (mismo criterio que navigation.ts).
//
// El texto del toast calca el que devuelve la API (ver requireAdmin/
// requirePermission en el backend: "Requiere privilegios de administrador" /
// `Requiere el permiso "resource:action"`), para que decir "qué permiso hace
// falta" sea consistente en toda la app: tanto si un componente descubre el
// 403 llamando a la API (p. ej. TkcCredentialsCard, vía getErrorMessage) como
// si esta guarda lo corta ANTES de llegar a pedir nada.
export function requireResourceAccess(
	resource: string | undefined,
	context: { isAdmin: boolean; permissions: MyPermission[] },
) {
	if (canAccessResource(resource, context)) return;
	toast.error(
		resource === undefined
			? "Requiere privilegios de administrador."
			: `Requiere algún permiso sobre "${resource}".`,
	);
	throw redirect({ to: "/dashboard" });
}

// Igual, pero para una ruta que dispara una acción puntual (crear/editar) y
// exige el permiso EXACTO "resource:action", no solo cualquier permiso sobre
// el recurso (p. ej. /employees/new exige employees:write, no employees:read).
export function requirePermissionAccess(
	resource: string,
	action: string,
	context: { isAdmin: boolean; permissions: MyPermission[] },
) {
	if (hasPermission(resource, action, context)) return;
	toast.error(`Requiere el permiso "${resource}:${action}".`);
	throw redirect({ to: "/dashboard" });
}
