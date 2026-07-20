import { Link } from "@tanstack/react-router";
import { Menu, ShieldCheck } from "lucide-react";
import type { AuthSession } from "@/modules/auth/shared/types.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/modules/common/components/ui/dropdown-menu.tsx";
import { cn } from "@/modules/common/lib/utils.ts";
import { useScrolled } from "../lib/use-scrolled.ts";
import { NAV_ITEMS } from "../shared/navigation.ts";
import { NavLinks } from "./nav-links.tsx";
import { UserMenu } from "./user-menu.tsx";

export function AdminHeader({ session }: { session: AuthSession }) {
	const scrolled = useScrolled();

	return (
		// El padding del <header> (0 en el top) es lo que separa la barra de los
		// bordes de la ventana al hacer scroll, dando el efecto de isla flotante;
		// en el top desaparece y la barra vuelve a integrarse a todo lo ancho.
		<header
			className={cn(
				"sticky top-0 z-50 w-full transition-[padding] duration-300",
				scrolled ? "px-3 pt-3 sm:px-4" : "px-0 pt-0",
			)}
		>
			<div
				className={cn(
					"mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 transition-[background-color,border-color,box-shadow,backdrop-filter,border-radius] duration-300 sm:gap-3",
					scrolled
						? "rounded-2xl border border-border/60 bg-background/70 shadow-lg shadow-black/5 backdrop-blur-xl supports-backdrop-filter:bg-background/60"
						: "border-b border-transparent bg-transparent",
				)}
			>
				<Link
					to="/dashboard"
					className="flex min-w-0 shrink-0 items-center gap-2 font-heading text-foreground"
				>
					<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<ShieldCheck className="size-5" />
					</span>
					<span className="hidden text-base font-semibold sm:block">
						Elineas IS
					</span>
				</Link>

				<nav className="ml-2 hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex">
					<NavLinks />
				</nav>

				<div className="ml-auto flex items-center gap-2">
					{/* Navegación en móvil: menú desplegable junto al de usuario, en
					    vez de una fila con scroll horizontal (evita que la página
					    tenga que desplazarse de lado). */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Abrir menú de navegación"
								className="lg:hidden"
							>
								<Menu />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56 p-2">
							{NAV_ITEMS.map((item) => (
								<DropdownMenuItem key={item.to} asChild>
									<Link
										to={item.to}
										activeOptions={{ exact: item.to === "/dashboard" }}
										className="data-[status=active]:bg-accent data-[status=active]:font-semibold data-[status=active]:text-accent-foreground"
									>
										<item.icon />
										{item.label}
									</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<UserMenu session={session} />
				</div>
			</div>
		</header>
	);
}
