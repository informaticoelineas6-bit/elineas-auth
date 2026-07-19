import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorStatus } from "@/modules/common/lib/errors.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import { userRolesQueries } from "@/modules/user-roles/queries/user-roles.ts";

// Card "Roles del usuario" de la ficha de empleado: asignaciones del usuario
// enlazado (GET /api/user-roles?userId=…) con atajo para gestionarlas.
export function EmployeeRolesCard({ userId }: { userId: string | null }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Roles del usuario</CardTitle>
				<CardDescription>
					{userId
						? "Roles asignados a la cuenta de usuario enlazada."
						: "Este empleado no tiene una cuenta de usuario enlazada, por lo que no puede tener roles ni iniciar sesión."}
				</CardDescription>
				{userId && (
					<CardAction>
						<Button asChild variant="outline" size="sm">
							<Link to="/user-roles" search={{ userId }}>
								<KeyRound />
								Gestionar roles
							</Link>
						</Button>
					</CardAction>
				)}
			</CardHeader>
			{userId && (
				<CardContent>
					<EmployeeRolesList userId={userId} />
				</CardContent>
			)}
		</Card>
	);
}

// El listado de user-roles solo devuelve ids (roleId), así que se cruza con los
// listados de roles y sistemas para mostrar nombres. `limit: 100` es el máximo
// del IS y cubre de sobra el catálogo actual; con más de 100 roles o sistemas
// habría que paginar el cruce.
function EmployeeRolesList({ userId }: { userId: string }) {
	const assignments = useQuery(userRolesQueries.list({ userId, limit: 100 }));
	const roles = useQuery(rolesQueries.list({ limit: 100 }));
	const systems = useQuery(systemsQueries.list({ limit: 100 }));

	if (getErrorStatus(assignments.error) === 403) {
		return (
			<p className="text-sm text-muted-foreground">
				No tienes permisos para ver las asignaciones de rol.
			</p>
		);
	}
	if (assignments.isError) {
		return (
			<p className="text-sm text-destructive">
				No se pudieron cargar los roles.{" "}
				<button
					type="button"
					className="underline underline-offset-2"
					onClick={() => assignments.refetch()}
				>
					Reintentar
				</button>
			</p>
		);
	}
	if (assignments.isPending || roles.isPending || systems.isPending) {
		return (
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-6 w-28" />
				<Skeleton className="h-6 w-36" />
			</div>
		);
	}

	const userRoles = assignments.data.userRoles;
	if (userRoles.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Sin roles asignados. El usuario no podrá iniciar sesión en ningún
				sistema hasta que tenga al menos uno.
			</p>
		);
	}

	// Los cruces pueden fallar (rol de un listado paginado más allá del límite o
	// sin permisos sobre roles/sistemas): se degrada mostrando el id.
	const roleById = new Map(roles.data?.roles.map((role) => [role.id, role]));
	const systemById = new Map(
		systems.data?.systems.map((system) => [system.id, system]),
	);

	return (
		<div className="flex flex-wrap gap-2">
			{userRoles.map((userRole) => {
				const role = roleById.get(userRole.roleId);
				const system = role ? systemById.get(role.systemId) : undefined;
				return (
					<Badge key={userRole.id} variant="secondary">
						{role?.name ?? userRole.roleId}
						{system && (
							<span className="text-muted-foreground"> · {system.name}</span>
						)}
					</Badge>
				);
			})}
		</div>
	);
}
