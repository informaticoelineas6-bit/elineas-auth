import { useQuery } from "@tanstack/react-query";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { CopyButton } from "@/modules/common/components/partials/copy-button.tsx";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/modules/common/components/ui/dialog.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorMessage, reportError } from "@/modules/common/lib/errors.ts";
import { formatDate } from "@/modules/common/lib/format.ts";
import {
	systemsQueries,
	useRevokeServiceKey,
	useRotateServiceKey,
} from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";

// Card "Clave de servicio" de la ficha: la clave sustituye al captcha en
// POST /api/auth/sign-in (cabecera X-Service-Key) para clientes sin navegador.
// El IS solo guarda su hash, así que la clave en claro se muestra UNA vez, al
// generarla o rotarla.
export function SystemServiceKeyPanel({ system }: { system: System }) {
	const query = useQuery(systemsQueries.serviceKey(system.id));
	const rotate = useRotateServiceKey();
	const revoke = useRevokeServiceKey();

	const [newKey, setNewKey] = useState<string | null>(null);
	const [confirming, setConfirming] = useState<"rotate" | "revoke" | null>(
		null,
	);

	const hasKey = query.data?.hasKey ?? false;

	function generate() {
		rotate.mutate(system.id, {
			onSuccess: ({ key }) => {
				setConfirming(null);
				setNewKey(key);
			},
			onError: (error) => reportError(error),
		});
	}

	function confirmRevoke() {
		revoke.mutate(system.id, {
			onSuccess: () => {
				toast.success("Clave de servicio revocada");
				setConfirming(null);
			},
			onError: (error) => reportError(error),
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Clave de servicio</CardTitle>
				<CardDescription>
					Permite iniciar sesión sin captcha a clientes sin navegador (backends,
					Postman). Se envía en la cabecera <code>X-Service-Key</code> junto con
					el <code>systemSlug</code>.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{query.isPending ? (
					<Skeleton className="h-9 w-full" />
				) : query.isError ? (
					<div className="flex items-center justify-between gap-3 text-sm">
						<span className="text-muted-foreground">
							{getErrorMessage(query.error)}
						</span>
						<Button variant="outline" size="sm" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					</div>
				) : (
					<>
						<div className="flex items-center gap-2 text-sm">
							<Badge variant={hasKey ? "default" : "secondary"}>
								{hasKey ? "Activa" : "Sin clave"}
							</Badge>
							{hasKey && query.data?.createdAt && (
								<span className="text-muted-foreground">
									Generada el {formatDate(query.data.createdAt)}
								</span>
							)}
						</div>
						<div className="flex flex-wrap gap-2">
							{hasKey ? (
								<>
									<Button
										variant="outline"
										onClick={() => setConfirming("rotate")}
									>
										<RefreshCw />
										Rotar clave
									</Button>
									<Button
										variant="destructive"
										onClick={() => setConfirming("revoke")}
									>
										<Trash2 />
										Revocar
									</Button>
								</>
							) : (
								<Button onClick={generate} disabled={rotate.isPending}>
									<KeyRound />
									Generar clave
								</Button>
							)}
						</div>
					</>
				)}
			</CardContent>

			<ConfirmDialog
				open={confirming === "rotate"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Rotar clave de servicio"
				description="Se generará una clave nueva y la actual dejará de funcionar de inmediato. Los clientes que la usen fallarán hasta que actualices su configuración."
				confirmLabel="Rotar"
				destructive
				loading={rotate.isPending}
				onConfirm={generate}
			/>
			<ConfirmDialog
				open={confirming === "revoke"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Revocar clave de servicio"
				description="La clave dejará de funcionar y los clientes sin navegador no podrán iniciar sesión en este sistema."
				confirmLabel="Revocar"
				destructive
				loading={revoke.isPending}
				onConfirm={confirmRevoke}
			/>

			<Dialog
				open={newKey !== null}
				onOpenChange={(open) => !open && setNewKey(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Clave de servicio generada</DialogTitle>
						<DialogDescription>
							Cópiala ahora y guárdala en el servidor del cliente (p. ej.{" "}
							<code>AUTH_SERVICE_KEY</code>). No se podrá volver a ver.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-1 rounded-md border bg-muted px-3 py-2">
						<code className="min-w-0 flex-1 break-all font-mono text-xs">
							{newKey}
						</code>
						{newKey && <CopyButton value={newKey} label="Copiar clave" />}
					</div>
					<DialogFooter>
						<Button onClick={() => setNewKey(null)}>Ya la guardé</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
