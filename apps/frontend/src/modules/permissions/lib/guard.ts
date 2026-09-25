import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { canAccessResource } from "./access.ts";
import type { MyPermission } from "../shared/types.ts";

// Para usar en `beforeLoad` de una ruta admin-only o que exige un permiso
// concreto: si el usuario no puede acceder, CANCELA la navegación (redirect)
// en vez de dejarla completar y mostrar un estado "sin permisos" ya dentro de
// la página. Evita que alguien sin permiso llegue a ver el layout, las
// queries en pending o el flash de la página antes del 403 de la API.
//
// `resource: undefined` = admin-only (mismo criterio que navigation.ts).
export function requireResourceAccess(
	resource: string | undefined,
	context: { isAdmin: boolean; permissions: MyPermission[] },
) {
	if (canAccessResource(resource, context)) return;
	toast.error("No tienes permisos para acceder a esta sección.");
	throw redirect({ to: "/dashboard" });
}
