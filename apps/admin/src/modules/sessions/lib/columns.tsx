import type { ColumnDef } from "@tanstack/react-table";
import { Monitor, Smartphone } from "lucide-react";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import { parseUserAgent } from "./user-agent.ts";
import type { AdminSafeSession } from "../shared/types.ts";

// Columnas del listado administrativo de sesiones (todas, de todos los
// usuarios). `currentId` distingue la sesión propia con una insignia; la
// revocación se delega a la página (id de la fila, admite revocar cualquiera).
export function getAdminSessionColumns({
	currentId,
	onRevoke,
}: {
	currentId: string | undefined;
	onRevoke: (session: AdminSafeSession) => void;
}): ColumnDef<AdminSafeSession, unknown>[] {
	return [
		{
			id: "user",
			header: "Usuario",
			cell: ({ row }) => (
				<div className="flex items-center gap-2 min-w-0">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="truncate font-medium">
								{row.original.user.name}
							</span>
							{row.original.id === currentId && (
								<Badge variant="default">Tú</Badge>
							)}
						</div>
						<p className="truncate text-xs text-muted-foreground">
							{row.original.user.email}
						</p>
					</div>
				</div>
			),
		},
		{
			id: "device",
			header: "Dispositivo",
			cell: ({ row }) => {
				const { os, label } = parseUserAgent(row.original.userAgent);
				const isMobile = os === "Android" || os === "iPhone" || os === "iPad";
				const DeviceIcon = isMobile ? Smartphone : Monitor;
				return (
					<div className="flex items-center gap-2 text-muted-foreground">
						<DeviceIcon className="size-4 shrink-0" />
						<span className="truncate">{label}</span>
					</div>
				);
			},
		},
		{
			accessorKey: "ipAddress",
			header: "IP",
			cell: ({ row }) => row.original.ipAddress || "—",
			meta: { className: "text-muted-foreground" },
		},
		{
			accessorKey: "createdAt",
			header: "Inicio",
			cell: ({ row }) => formatDate(row.original.createdAt),
		},
		{
			accessorKey: "expiresAt",
			header: "Expira",
			cell: ({ row }) => formatDate(row.original.expiresAt),
		},
		{
			id: "actions",
			header: "Acciones",
			meta: { className: "text-right", headerClassName: "text-right" },
			cell: ({ row }) => (
				<DataTableRowActions
					actions={[
						{
							label:
								row.original.id === currentId ? "Cerrar esta sesión" : "Revocar",
							destructive: true,
							onSelect: () => onRevoke(row.original),
						},
					]}
				/>
			),
		},
	];
}
