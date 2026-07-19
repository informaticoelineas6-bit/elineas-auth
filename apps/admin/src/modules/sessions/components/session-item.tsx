import { Monitor, Smartphone } from "lucide-react";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Spinner } from "@/modules/common/components/ui/spinner.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import { cn } from "@/modules/common/lib/utils.ts";
import { parseUserAgent } from "../lib/user-agent.ts";
import type { SafeSession } from "../shared/types.ts";

// Fila de una sesión activa: dispositivo/navegador, IP, alta y expiración, con
// la sesión actual resaltada. `onRevoke` revoca esta sesión (la actual también
// se puede cerrar; eso desloguea).
export function SessionItem({
	session,
	isCurrent,
	isRevoking,
	onRevoke,
}: {
	session: SafeSession;
	isCurrent: boolean;
	isRevoking: boolean;
	onRevoke: () => void;
}) {
	const { os, label } = parseUserAgent(session.userAgent);
	const isMobile = os === "Android" || os === "iPhone" || os === "iPad";
	const DeviceIcon = isMobile ? Smartphone : Monitor;

	return (
		<div
			className={cn(
				"flex items-start justify-between gap-4 rounded-lg border p-4",
				isCurrent && "border-primary/40 bg-primary/5",
			)}
		>
			<div className="flex min-w-0 items-start gap-3">
				<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<DeviceIcon className="size-4" />
				</span>
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2">
						<span className="font-medium">{label}</span>
						{isCurrent && <Badge variant="default">Sesión actual</Badge>}
					</div>
					<p className="text-sm text-muted-foreground">
						IP: {session.ipAddress || "—"}
					</p>
					<p className="text-xs text-muted-foreground">
						Inicio {formatDate(session.createdAt)} · Expira{" "}
						{formatDate(session.expiresAt)}
					</p>
				</div>
			</div>

			<Button
				variant="outline"
				size="sm"
				disabled={isRevoking}
				onClick={onRevoke}
			>
				{isRevoking && <Spinner />}
				{isCurrent ? "Cerrar esta sesión" : "Revocar"}
			</Button>
		</div>
	);
}
