import { ArrowDownAZ, ArrowUpAZ, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { ResolvedUser } from "../lib/columns.tsx";
import type { UserRoleDetail } from "../shared/types.ts";

export type CardsGroupBy = "systems" | "users";
type SortBy = "user" | "role";
type SortDir = "asc" | "desc";

type Group = {
	key: string;
	title: string;
	subtitle?: string;
	items: UserRoleDetail[];
};

// Agrupa las asignaciones por sistema o por usuario y ordena grupos y filas
// alfabéticamente para que el orden sea estable entre recargas.
function buildGroups(
	rows: UserRoleDetail[],
	groupBy: CardsGroupBy,
	usersById: Map<string, ResolvedUser>,
	sortBy: SortBy,
	sortDir: SortDir,
): Group[] {
	const groups = new Map<string, Group>();
	for (const row of rows) {
		const user = usersById.get(row.userId) ?? row.user ?? undefined;
		const key = groupBy === "systems" ? row.system.id : row.userId;
		let group = groups.get(key);
		if (!group) {
			group =
				groupBy === "systems"
					? {
							key,
							title: row.system.name,
							subtitle: row.system.slug,
							items: [],
						}
					: {
							key,
							title: user?.name ?? row.userId,
							subtitle: user?.email,
							items: [],
						};
			groups.set(key, group);
		}
		group.items.push(row);
	}
	const collator = new Intl.Collator("es", { sensitivity: "base" });
	const dir = sortDir === "asc" ? 1 : -1;
	const userName = (row: UserRoleDetail) =>
		usersById.get(row.userId)?.name ?? row.user?.name ?? row.userId;
	const rowKey = (row: UserRoleDetail) =>
		sortBy === "user" ? userName(row) : row.role.name;
	// Desempate por el otro criterio para que el orden sea estable.
	const otherKey = (row: UserRoleDetail) =>
		sortBy === "user" ? row.role.name : userName(row);
	// Las tarjetas de sistema siempre van por nombre de sistema; las de usuario
	// siguen el orden elegido cuando este es "usuario".
	const groupDir = groupBy === "users" && sortBy === "user" ? dir : 1;
	return [...groups.values()]
		.sort((a, b) => groupDir * collator.compare(a.title, b.title))
		.map((group) => ({
			...group,
			items: [...group.items].sort(
				(a, b) =>
					dir * collator.compare(rowKey(a), rowKey(b)) ||
					collator.compare(otherKey(a), otherKey(b)),
			),
		}));
}

export function UserRolesCards({
	rows,
	groupBy,
	usersById,
	isLoading,
	isError,
	onRetry,
	emptyText,
	onRevoke,
}: {
	rows: UserRoleDetail[];
	groupBy: CardsGroupBy;
	usersById: Map<string, ResolvedUser>;
	isLoading: boolean;
	isError: boolean;
	onRetry: () => void;
	emptyText: string;
	onRevoke: (userRole: UserRoleDetail) => void;
}) {
	const [sortBy, setSortBy] = useState<SortBy>("user");
	const [sortDir, setSortDir] = useState<SortDir>("asc");
	const groups = useMemo(
		() => buildGroups(rows, groupBy, usersById, sortBy, sortDir),
		[rows, groupBy, usersById, sortBy, sortDir],
	);

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{["a", "b", "c"].map((id) => (
					<Skeleton key={id} className="h-40 rounded-xl" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-lg border p-8 text-sm text-muted-foreground">
				No se pudieron cargar las asignaciones.
				<Button variant="outline" size="sm" onClick={onRetry}>
					Reintentar
				</Button>
			</div>
		);
	}

	if (groups.length === 0) {
		return (
			<div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
				{emptyText}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span>Ordenar por</span>
				<Select
					value={sortBy}
					onValueChange={(value) => setSortBy(value as SortBy)}
				>
					<SelectTrigger size="sm" className="w-56">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="user">Nombre de usuario</SelectItem>
						<SelectItem value="role">Nombre de rol</SelectItem>
					</SelectContent>
				</Select>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label={
						sortDir === "asc" ? "Orden ascendente" : "Orden descendente"
					}
					onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
				>
					{sortDir === "asc" ? <ArrowDownAZ /> : <ArrowUpAZ />}
				</Button>
			</div>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{groups.map((group) => (
					<Card key={group.key} className="max-h-96 gap-4 py-5">
						<CardHeader className="px-5">
							<CardTitle className="flex items-center gap-2">
								{group.title}
								{groupBy === "systems" && group.subtitle && (
									<Badge variant="outline" className="font-mono text-xs">
										{group.subtitle}
									</Badge>
								)}
							</CardTitle>
							<CardDescription className="flex items-center gap-1.5">
								{groupBy === "users" && group.subtitle && (
									<span className="truncate">{group.subtitle} ·</span>
								)}
								<Users className="size-3.5" />
								{group.items.length}{" "}
								{groupBy === "systems"
									? group.items.length === 1
										? "asignación"
										: "asignaciones"
									: group.items.length === 1
										? "rol"
										: "roles"}
							</CardDescription>
						</CardHeader>
						<CardContent className="min-h-0 flex-1 overflow-y-auto px-5">
							<ul className="divide-y">
								{group.items.map((item) => {
									const user =
										usersById.get(item.userId) ?? item.user ?? undefined;
									return (
										<li
											key={item.id}
											className="flex items-center justify-between gap-3 py-2"
										>
											<div className="min-w-0">
												{groupBy === "systems" ? (
													<>
														<p className="truncate text-sm font-medium">
															{user?.name ?? item.userId}
														</p>
														<p className="truncate text-xs text-muted-foreground">
															{user?.email}
														</p>
													</>
												) : (
													<>
														<p className="truncate text-sm font-medium">
															{item.role.name}
														</p>
														<p className="truncate text-xs text-muted-foreground">
															{item.system.name}
														</p>
													</>
												)}
											</div>
											<div className="flex shrink-0 items-center gap-2">
												{groupBy === "systems" && (
													<Badge variant="secondary">{item.role.name}</Badge>
												)}
												<span className="hidden text-xs text-muted-foreground sm:inline">
													{formatDate(item.createdAt)}
												</span>
												<Button
													variant="ghost"
													size="icon-sm"
													aria-label="Revocar asignación"
													onClick={() => onRevoke(item)}
												>
													<Trash2 className="text-destructive" />
												</Button>
											</div>
										</li>
									);
								})}
							</ul>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
