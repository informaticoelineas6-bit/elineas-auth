import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Info, LogOut, MonitorX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { signOutFn } from "@/modules/auth/actions/auth.ts";
import {
	DataTable,
	useListControls,
} from "@/modules/common/components/data-table";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { getErrorStatus, reportError } from "@/modules/common/lib/errors.ts";
import { getAdminSessionColumns } from "@/modules/sessions/lib/columns.tsx";
import { sessionFiltersSchema } from "@/modules/sessions/lib/validation.ts";
import {
	sessionsQueries,
	useAdminRevokeSession,
	useRevokeAllSessions,
	useRevokeOtherSessions,
} from "@/modules/sessions/queries/sessions.ts";
import type {
	AdminSafeSession,
	SessionFilters,
} from "@/modules/sessions/shared/types.ts";

export const Route = createFileRoute("/_authed/sessions")({
	validateSearch: sessionFiltersSchema,
	component: SessionsPage,
});

// El layout `_authed` ya bloquea a quien no tenga rol admin (ForbiddenScreen
// en línea, ver AuthedLayout): esta página nunca se monta para un usuario sin
// ese rol, así que aquí se asume siempre admin y se listan las sesiones de
// TODOS los usuarios, distinguiendo la propia con la insignia "Tú".
function SessionsPage() {
	const navigate = useNavigate();
	const signOut = useServerFn(signOutFn);

	// Sesiones propias: solo para decidir si tiene sentido ofrecer "cerrar mis
	// otras sesiones" / "cerrar todas las mías" (acciones de autoservicio,
	// separadas de la revocación de cualquier sesión en la tabla de abajo).
	const own = useQuery(sessionsQueries.list());
	const current = useQuery(sessionsQueries.current());
	const adminRevokeSession = useAdminRevokeSession();
	const revokeOthers = useRevokeOtherSessions();
	const revokeAll = useRevokeAllSessions();

	const { filters, controls } = useListControls<SessionFilters>();
	const allSessions = useQuery(sessionsQueries.allList(filters));

	// Confirmaciones: revocar una concreta, o una acción masiva sobre las propias.
	const [toRevoke, setToRevoke] = useState<AdminSafeSession | null>(null);
	const [bulk, setBulk] = useState<"others" | "all" | null>(null);

	const currentId = current.data?.id;
	const hasOwnSessions = (own.data?.length ?? 0) > 0;
	const isForbidden = getErrorStatus(allSessions.error) === 403;

	// Cierra la sesión local (cookies) y vuelve al login. Reutiliza signOutFn.
	const logout = useMutation({
		mutationFn: () => signOut(),
		onSuccess: () => navigate({ to: "/" }),
		onError: (error) => reportError(error, "No se pudo cerrar la sesión."),
	});

	function confirmRevoke() {
		if (!toRevoke) return;
		if (toRevoke.id === currentId) {
			// Revocar la propia sesión equivale a cerrar sesión: limpia cookies y
			// redirige al login.
			setToRevoke(null);
			logout.mutate();
			return;
		}
		adminRevokeSession.mutate(toRevoke.id, {
			onSuccess: () => {
				toast.success("Sesión revocada");
				setToRevoke(null);
			},
			onError: (error) => reportError(error),
		});
	}

	function confirmBulk() {
		if (bulk === "others") {
			revokeOthers.mutate(undefined, {
				onSuccess: () => {
					toast.success("Se cerraron las demás sesiones");
					setBulk(null);
				},
				onError: (error) => reportError(error),
			});
			return;
		}
		if (bulk === "all") {
			// Cierra todas incluida la actual; después se limpia la sesión local.
			revokeAll.mutate(undefined, {
				onSuccess: () => {
					setBulk(null);
					logout.mutate();
				},
				onError: (error) => reportError(error),
			});
		}
	}

	const busy =
		adminRevokeSession.isPending ||
		revokeOthers.isPending ||
		revokeAll.isPending ||
		logout.isPending;

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Sesiones" }]} />
			<PageHeader
				title="Sesiones"
				description='Revisa y revoca las sesiones activas de todos los usuarios. Las tuyas están marcadas con "Tú".'
				actions={
					hasOwnSessions && (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => setBulk("others")}
							>
								<MonitorX />
								Cerrar mis otras sesiones
							</Button>
							<Button
								variant="destructive"
								disabled={busy}
								onClick={() => setBulk("all")}
							>
								<LogOut />
								Cerrar todas las mías
							</Button>
						</div>
					)
				}
			/>

			{/* Nota UX: la revocación no invalida los JWT ya emitidos al instante. */}
			<div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
				<Info className="mt-0.5 size-4 shrink-0" />
				<span>
					Al revocar una sesión, el acceso deja de renovarse, pero un token ya
					emitido puede seguir siendo válido unos minutos hasta que expira.
				</span>
			</div>

			{isForbidden ? (
				<ForbiddenState description="No tienes permisos para ver las sesiones de todos los usuarios." />
			) : (
				<DataTable
					columns={getAdminSessionColumns({
						currentId,
						onRevoke: (session) => setToRevoke(session),
					})}
					data={allSessions.data?.sessions ?? []}
					pagination={allSessions.data?.pagination}
					isLoading={allSessions.isPending}
					isFetching={allSessions.isFetching}
					isError={allSessions.isError}
					onRetry={() => allSessions.refetch()}
					{...controls}
					getRowId={(session) => session.id}
					searchPlaceholder="Buscar por nombre o correo…"
					emptyTitle="Sin sesiones"
					emptyDescription="No hay sesiones activas."
				/>
			)}

			<ConfirmDialog
				open={toRevoke !== null}
				onOpenChange={(open) => !open && setToRevoke(null)}
				title={
					toRevoke?.id === currentId ? "Cerrar esta sesión" : "Revocar sesión"
				}
				description={
					toRevoke?.id === currentId
						? "Vas a cerrar la sesión de este dispositivo. Tendrás que volver a iniciar sesión."
						: "Se revocará el acceso de ese dispositivo. Tendrá que volver a iniciar sesión."
				}
				confirmLabel={toRevoke?.id === currentId ? "Cerrar sesión" : "Revocar"}
				destructive
				loading={adminRevokeSession.isPending || logout.isPending}
				onConfirm={confirmRevoke}
			/>

			<ConfirmDialog
				open={bulk === "others"}
				onOpenChange={(open) => !open && setBulk(null)}
				title="Cerrar las demás sesiones"
				description="Se cerrarán todas las sesiones excepto la de este dispositivo."
				confirmLabel="Cerrar las demás"
				destructive
				loading={revokeOthers.isPending}
				onConfirm={confirmBulk}
			/>

			<ConfirmDialog
				open={bulk === "all"}
				onOpenChange={(open) => !open && setBulk(null)}
				title="Cerrar todas las sesiones"
				description="Se cerrarán todas las sesiones, incluida la de este dispositivo. Tendrás que volver a iniciar sesión."
				confirmLabel="Cerrar todas"
				destructive
				loading={revokeAll.isPending || logout.isPending}
				onConfirm={confirmBulk}
			/>
		</div>
	);
}
