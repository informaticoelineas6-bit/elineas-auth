import { Plus } from "lucide-react";
import { useState } from "react";
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
import { CreatePermissionDialog } from "@/modules/permissions/components/create-permission-dialog.tsx";
import { EditPermissionDialog } from "@/modules/permissions/components/edit-permission-dialog.tsx";
import type { SystemPermissions } from "@/modules/permissions/shared/types.ts";

// Card "un sistema" de la vista de administración de permisos: título el
// nombre del sistema, badges por permiso (resource:action) asignado a
// cualquiera de sus roles. Click en un badge abre la edición/borrado; el
// botón "+" del header abre el alta para este sistema.
export function SystemPermissionsCard({ entry }: { entry: SystemPermissions }) {
	const { system, permissions } = entry;
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const editing = permissions.find((p) => p.id === editingId) ?? null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{system.name}</CardTitle>
				<CardDescription>
					{permissions.length === 0
						? "Sin permisos definidos"
						: `${permissions.length} permiso(s)`}
				</CardDescription>
				<CardAction>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Nuevo permiso"
						title="Nuevo permiso"
						onClick={() => setCreating(true)}
					>
						<Plus />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{permissions.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Este sistema aún no tiene permisos asignados a sus roles.
					</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{permissions.map((permission) => (
							<Badge
								key={permission.id}
								asChild
								variant="secondary"
								className="cursor-pointer"
							>
								<button
									type="button"
									onClick={() => setEditingId(permission.id)}
									title={permission.description ?? undefined}
								>
									{permission.resource}:{permission.action}
								</button>
							</Badge>
						))}
					</div>
				)}
			</CardContent>

			<CreatePermissionDialog
				system={system}
				open={creating}
				onOpenChange={setCreating}
			/>

			{editing && (
				<EditPermissionDialog
					system={system}
					permission={editing}
					open={editingId !== null}
					onOpenChange={(open) => !open && setEditingId(null)}
				/>
			)}
		</Card>
	);
}
