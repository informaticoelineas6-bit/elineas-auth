import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { AuthSession } from "@/modules/auth/shared/types.ts";
import { cn } from "@/modules/common/lib/utils.ts";
import { useScrolled } from "../lib/use-scrolled.ts";
import { NavLinks } from "./nav-links.tsx";
import { UserMenu } from "./user-menu.tsx";

// Cabecera fija de la consola. Arranca transparente sobre el fondo y, al hacer
// scroll, gana fondo semiopaco + blur + borde inferior mientras queda pegada al
// tope (sticky). La transición anima el cambio de transparencia.
export function AdminHeader({ session }: { session: AuthSession }) {
	const scrolled = useScrolled();

	return (
		<header
			className={cn(
				"sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
				scrolled
					? "border-b border-border/60 bg-background/70 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
					: "border-b border-transparent bg-transparent",
			)}
		>
			<div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
				<Link
					to="/dashboard"
					className="flex shrink-0 items-center gap-2 font-heading text-foreground"
				>
					<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<ShieldCheck className="size-5" />
					</span>
					<span className="hidden text-base font-semibold sm:block">
						Consola
					</span>
				</Link>

				<nav className="ml-2 hidden items-center gap-1 lg:flex">
					<NavLinks />
				</nav>

				<div className="ml-auto flex items-center gap-2">
					<UserMenu session={session} />
				</div>
			</div>

			{/* Navegación en móvil: fila desplazable horizontalmente. */}
			<div className="border-t border-border/40 lg:hidden">
				<nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
					<NavLinks />
				</nav>
			</div>
		</header>
	);
}
