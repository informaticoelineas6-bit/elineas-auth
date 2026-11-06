import { useQuery } from "@tanstack/react-query";
import { Crown, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorMessage, reportError } from "@/modules/common/lib/errors.ts";
import {
	departmentsQueries,
	useRemoveDepartmentMember,
	useSetMemberHead,
} from "../queries/departments.ts";
import type { DepartmentMember } from "../shared/types.ts";
import { AddMembersDialog } from "./add-members-dialog.tsx";

// Miembros de un departamento (jefes primero, orden del servidor): marcar o
// quitar jefe, quitar de departamento y agregar varios usuarios.
export function DepartmentMembersCard({
	departmentId,
	departmentName,
	canWrite,
}: {
	departmentId: string;
	departmentName: string;
	canWrite: boolean;
}) {
	const query = useQuery(departmentsQueries.members(departmentId));
	const setHead = useSetMemberHead();
	const remove = useRemoveDepartmentMember();
	const [adding, setAdding] = useState(false);

	const members = query.data ?? [];

	function fullName(member: DepartmentMember) {
		return `${member.name} ${member.lastName}`.trim();
	}

	function toggleHead(member: DepartmentMember) {
		setHead.mutate(
			{
				id: departmentId,
				employeeId: member.employeeId,
				isHead: !member.isHead,
			},
			{
				onSuccess: () =>
					toast.success(
						member.isHead
							? `${fullName(member)} ya no es jefe`
							: `${fullName(member)} es jefe del departamento`,
					),
				onError: (error) => reportError(error),
			},
		);
	}

	function removeMember(member: DepartmentMember) {
		remove.mutate(
			{ id: departmentId, employeeId: member.employeeId },
			{
				onSuccess: () => toast.success(`${fullName(member)} quitado`),
				onError: (error) => reportError(error),
			},
		);
	}

	return (
		<Card className="lg:col-span-2">
			<CardHeader className="flex-row items-center justify-between gap-2">
				<CardTitle>Miembros ({members.length})</CardTitle>
				{canWrite && (
					<Button size="sm" onClick={() => setAdding(true)}>
						<UserPlus />
						Agregar usuarios
					</Button>
				)}
			</CardHeader>
			<CardContent>
				{query.isPending ? (
					<Skeleton className="h-24 rounded-md" />
				) : query.isError ? (
					<div className="space-y-2 text-sm text-muted-foreground">
						<p>{getErrorMessage(query.error)}</p>
						<Button variant="outline" size="sm" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					</div>
				) : members.length === 0 ? (
					<p className="py-4 text-center text-sm text-muted-foreground">
						Este departamento aún no tiene miembros.
					</p>
				) : (
					<ul className="divide-y">
						{members.map((member) => (
							<li
								key={member.employeeId}
								className="flex items-center gap-3 py-2"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate text-sm font-medium">
											{fullName(member)}
										</span>
										{member.isHead && (
											<Badge>
												<Crown />
												Jefe
											</Badge>
										)}
									</div>
									{member.email && (
										<span className="block truncate text-xs text-muted-foreground">
											{member.email}
										</span>
									)}
								</div>
								{canWrite && (
									<div className="flex shrink-0 gap-1">
										<Button
											variant="outline"
											size="sm"
											disabled={setHead.isPending}
											onClick={() => toggleHead(member)}
										>
											<Crown />
											{member.isHead ? "Quitar jefe" : "Hacer jefe"}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Quitar a ${fullName(member)}`}
											disabled={remove.isPending}
											onClick={() => removeMember(member)}
										>
											<UserMinus />
										</Button>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<AddMembersDialog
				departmentId={departmentId}
				departmentName={departmentName}
				open={adding}
				onOpenChange={setAdding}
			/>
		</Card>
	);
}
