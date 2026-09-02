import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
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

// Card "Roles del sistema" de la ficha: roles definidos para este sistema
// (GET /api/roles?systemId=…) con atajo a la sección de roles prefiltrada.
// `limit: 100` es el máximo del IS; con más roles habría que paginar aquí.
export function SystemRolesPanel({ systemId }: { systemId: string }) {
	const query = useQuery(rolesQueries.list({ systemId, limit: 100 }));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Roles del sistema</CardTitle>
				<CardDescription>
					Roles que las aplicaciones de este sistema pueden asignar a sus
					usuarios.
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/roles" search={{ systemId }}>
							<KeyRound />
							Gestionar roles
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<SystemRolesList
					isPending={query.isPending}
					isError={query.isError}
					isForbidden={getErrorStatus(query.error) === 403}
					roles={query.data?.roles ?? []}
					onRetry={() => query.refetch()}
				/>
			</CardContent>
		</Card>
	);
}

function SystemRolesList({
	isPending,
	isError,
	isForbidden,
	roles,
	onRetry,
}: {
	isPending: boolean;
	isError: boolean;
	isForbidden: boolean;
	roles: { id: string; name: string }[];
	onRetry: () => void;
}) {
	if (isForbidden) {
		return (
			<p className="text-sm text-muted-foreground">
				No tienes permisos para ver los roles de este sistema.
			</p>
		);
	}
	if (isError) {
		return (
			<p className="text-sm text-destructive">
				No se pudieron cargar los roles.{" "}
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
			<div className="space-y-2">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-5 w-32" />
			</div>
		);
	}
	if (roles.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Este sistema aún no tiene roles definidos.
			</p>
		);
	}
	return (
		<ul className="space-y-1 text-sm text-foreground">
			{roles.map((role) => (
				<li key={role.id} className="flex items-center gap-2">
					<KeyRound className="size-3.5 text-muted-foreground" />
					{role.name}
				</li>
			))}
		</ul>
	);
}
