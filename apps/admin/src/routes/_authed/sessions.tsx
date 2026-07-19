import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Info, LogOut, MonitorX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { signOutFn } from "@/modules/auth/actions/auth.ts";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { SessionItem } from "@/modules/sessions/components/session-item.tsx";
import {
	sessionsQueries,
	useRevokeAllSessions,
	useRevokeOtherSessions,
	useRevokeSession,
} from "@/modules/sessions/queries/sessions.ts";
import type { SafeSession } from "@/modules/sessions/shared/types.ts";

export const Route = createFileRoute("/_authed/sessions")({
	component: SessionsPage,
});

function SessionsPage() {
	const navigate = useNavigate();
	const signOut = useServerFn(signOutFn);

	const list = useQuery(sessionsQueries.list());
	const current = useQuery(sessionsQueries.current());
	const revokeSession = useRevokeSession();
	const revokeOthers = useRevokeOtherSessions();
	const revokeAll = useRevokeAllSessions();

	// Confirmaciones: revocar una concreta, o una acción masiva.
	const [toRevoke, setToRevoke] = useState<SafeSession | null>(null);
	const [bulk, setBulk] = useState<"others" | "all" | null>(null);

	const isForbidden = getErrorStatus(list.error) === 403;
	const currentId = current.data?.id;

	// Cierra la sesión local (cookies) y vuelve al login. Reutiliza signOutFn.
	const logout = useMutation({
		mutationFn: () => signOut(),
		onSuccess: () => navigate({ to: "/" }),
		onError: (error) => reportError(error, "No se pudo cerrar la sesión."),
	});

	function confirmRevoke() {
		if (!toRevoke) return;
		const revokingCurrent = toRevoke.id === currentId;
		if (revokingCurrent) {
			// Revocar la propia sesión equivale a cerrar sesión: limpia cookies y
			// redirige al login.
			setToRevoke(null);
			logout.mutate();
			return;
		}
		revokeSession.mutate(toRevoke.id, {
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

	// Sesión actual primero; el resto por fecha de inicio descendente.
	const sessions = [...(list.data ?? [])].sort((a, b) => {
		if (a.id === currentId) return -1;
		if (b.id === currentId) return 1;
		return b.createdAt.localeCompare(a.createdAt);
	});

	const busy =
		revokeSession.isPending ||
		revokeOthers.isPending ||
		revokeAll.isPending ||
		logout.isPending;

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Sesiones" }]} />
			<PageHeader
				title="Sesiones"
				description="Revisa y revoca las sesiones activas de tu cuenta."
				actions={
					!isForbidden &&
					sessions.length > 0 && (
						<div className="flex gap-2">
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => setBulk("others")}
							>
								<MonitorX />
								Cerrar las demás
							</Button>
							<Button
								variant="destructive"
								disabled={busy}
								onClick={() => setBulk("all")}
							>
								<LogOut />
								Cerrar todas
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
				<ForbiddenState description="No tienes permisos para ver tus sesiones." />
			) : list.isPending ? (
				<div className="space-y-3">
					<Skeleton className="h-20 rounded-lg" />
					<Skeleton className="h-20 rounded-lg" />
				</div>
			) : list.isError ? (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
					<p className="font-medium text-foreground">
						No se pudieron cargar tus sesiones
					</p>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						{getErrorMessage(list.error)}
					</p>
					<Button
						variant="outline"
						className="mt-6"
						onClick={() => list.refetch()}
					>
						Reintentar
					</Button>
				</div>
			) : sessions.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No hay sesiones activas.
				</p>
			) : (
				<div className="space-y-3">
					{sessions.map((session) => (
						<SessionItem
							key={session.id}
							session={session}
							isCurrent={session.id === currentId}
							isRevoking={
								(revokeSession.isPending &&
									revokeSession.variables === session.id) ||
								(logout.isPending && session.id === currentId)
							}
							onRevoke={() => setToRevoke(session)}
						/>
					))}
				</div>
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
				loading={revokeSession.isPending || logout.isPending}
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
