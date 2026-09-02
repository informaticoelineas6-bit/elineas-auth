import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorStatus } from "@/modules/common/lib/errors.ts";
import { userRolesQueries } from "@/modules/user-roles/queries/user-roles.ts";
import type { MyUserRole } from "@/modules/user-roles/shared/types.ts";

// Bloque "Mis roles" (solo lectura): roles propios del usuario autenticado
// agrupados por sistema (GET /api/user-roles/me). No requiere rol admin.
export function MyRolesCard() {
	const query = useQuery(userRolesQueries.me());

	return (
		<Card>
			<CardHeader>
				<CardTitle>Mis roles</CardTitle>
				<CardDescription>
					Roles que tienes asignados, agrupados por sistema. Los gestiona un
					administrador.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<MyRolesContent
					isPending={query.isPending}
					isError={query.isError}
					isForbidden={getErrorStatus(query.error) === 403}
					roles={query.data ?? []}
					onRetry={() => query.refetch()}
				/>
			</CardContent>
		</Card>
	);
}

function MyRolesContent({
	isPending,
	isError,
	isForbidden,
	roles,
	onRetry,
}: {
	isPending: boolean;
	isError: boolean;
	isForbidden: boolean;
	roles: MyUserRole[];
	onRetry: () => void;
}) {
	if (isForbidden) {
		return (
			<p className="text-sm text-muted-foreground">
				No tienes permisos para ver tus roles.
			</p>
		);
	}
	if (isError) {
		return (
			<p className="text-sm text-destructive">
				No se pudieron cargar tus roles.{" "}
				<button
					type="button"
					className="underline underline-offset-2"
					onClick={onRetry}
				>
					Reintentar
				</button>
			</p>
		);
	}
	if (isPending) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-5 w-56" />
			</div>
		);
	}
	if (roles.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No tienes roles asignados.
			</p>
		);
	}

	// Agrupa por sistema conservando el orden de aparición.
	const bySystem = new Map<string, { name: string; roles: MyUserRole[] }>();
	for (const role of roles) {
		const entry = bySystem.get(role.system.id);
		if (entry) {
			entry.roles.push(role);
		} else {
			bySystem.set(role.system.id, { name: role.system.name, roles: [role] });
		}
	}

	return (
		<div className="space-y-4">
			{[...bySystem.values()].map((group) => (
				<div key={group.name} className="space-y-2">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{group.name}
					</p>
					<div className="flex flex-wrap gap-2">
						{group.roles.map((role) => (
							<Badge key={role.id} variant="secondary">
								{role.name}
							</Badge>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
