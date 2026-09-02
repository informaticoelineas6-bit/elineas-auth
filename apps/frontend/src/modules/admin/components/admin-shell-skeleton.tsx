import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";

// Estado de carga mientras se resuelven los roles del usuario (pendingComponent
// del layout _admin): reproduce la silueta de cabecera + contenido.
export function AdminShellSkeleton() {
	return (
		<div className="min-h-screen bg-background">
			<header className="w-full border-b border-border/60">
				<div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
					<Skeleton className="size-9 rounded-xl" />
					<div className="ml-2 hidden items-center gap-2 lg:flex">
						{Array.from({ length: 5 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: silueta estática
							<Skeleton key={i} className="h-8 w-24 rounded-full" />
						))}
					</div>
					<div className="ml-auto flex items-center gap-2">
						<Skeleton className="size-9 rounded-md" />
						<Skeleton className="size-8 rounded-full" />
					</div>
				</div>
			</header>
			<main className="mx-auto w-full max-w-7xl px-4 py-8">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="mt-3 h-4 w-80" />
				<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: silueta estática
						<Skeleton key={i} className="h-28 rounded-2xl" />
					))}
				</div>
			</main>
		</div>
	);
}
