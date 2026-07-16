import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleUser, LogOut, MonitorSmartphone } from "lucide-react";
import { signOutFn } from "@/modules/auth/actions/auth.ts";
import type { AuthSession } from "@/modules/auth/shared/types.ts";
import {
	Avatar,
	AvatarFallback,
} from "@/modules/common/components/ui/avatar.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/modules/common/components/ui/dropdown-menu.tsx";
import { reportError } from "@/modules/common/lib/errors.ts";
import { getInitials } from "../lib/initials.ts";

export function UserMenu({ session }: { session: AuthSession }) {
	const navigate = useNavigate();
	const logout = useServerFn(signOutFn);

	const logoutMutation = useMutation({
		mutationFn: () => logout(),
		onSuccess: () => navigate({ to: "/" }),
		onError: (error) =>
			reportError(error, "No se pudo cerrar sesión. Intenta nuevamente."),
	});

	const displayName = session.name ?? session.email ?? "Usuario";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Abrir menú de usuario"
					className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Avatar>
						<AvatarFallback>{getInitials(displayName)}</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<DropdownMenuLabel>
					<div className="flex flex-col gap-0.5">
						<span className="truncate font-medium">{displayName}</span>
						{session.email && (
							<span className="truncate text-xs font-normal text-muted-foreground">
								{session.email}
							</span>
						)}
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/profile">
						<CircleUser />
						Mi perfil
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to="/sessions">
						<MonitorSmartphone />
						Sesiones
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					disabled={logoutMutation.isPending}
					onSelect={(event) => {
						// Evita que el menú se cierre antes de disparar la mutación.
						event.preventDefault();
						logoutMutation.mutate();
					}}
				>
					<LogOut />
					{logoutMutation.isPending ? "Saliendo…" : "Cerrar sesión"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
