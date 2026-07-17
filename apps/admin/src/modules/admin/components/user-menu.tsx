import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleUser, LogOut, MonitorSmartphone } from "lucide-react";
import { signOutFn } from "@/modules/auth/actions/auth.ts";
import type { AuthSession } from "@/modules/auth/shared/types.ts";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
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
import { ThemeMenuItem } from "./theme-menu-item.tsx";

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
						<AvatarImage
							src={`https://api.dicebear.com/9.x/glass/svg?seed=${session.name}`}
						/>
						<AvatarFallback>{getInitials(displayName)}</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64 p-2">
				<DropdownMenuLabel className="px-2 py-2.5">
					<div className="flex flex-col gap-1">
						<span className="truncate font-medium">{displayName}</span>
						{session.email && (
							<span className="truncate text-xs font-normal text-muted-foreground">
								{session.email}
							</span>
						)}
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator className="my-2" />
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
				<ThemeMenuItem />
				<DropdownMenuSeparator className="my-2" />
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
