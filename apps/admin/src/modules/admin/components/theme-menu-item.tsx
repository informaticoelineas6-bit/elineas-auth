import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { setThemeFn } from "@/modules/common/actions/theme.ts";
import { DropdownMenuItem } from "@/modules/common/components/ui/dropdown-menu.tsx";
import type { Theme } from "@/modules/common/shared/types.ts";

const rootRoute = getRouteApi("__root__");

// Ciclo de temas al seleccionar el ítem.
const THEME_ORDER: Theme[] = ["dark", "light", "system"];

const THEME_META: Record<Theme, { label: string; icon: typeof Sun }> = {
	dark: { label: "Oscuro", icon: Moon },
	light: { label: "Claro", icon: Sun },
	system: { label: "Sistema", icon: Monitor },
};

// Selector de tema como ítem del menú, con el mismo estilo que el resto de
// opciones del dropdown. Cicla dark → light → system sin cerrar el menú.
export function ThemeMenuItem() {
	const theme = rootRoute.useLoaderData();
	const router = useRouter();
	const setTheme = useServerFn(setThemeFn);
	const [pending, setPending] = useState(false);

	const { label, icon: Icon } = THEME_META[theme];

	async function cycle() {
		const next =
			THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
		setPending(true);
		try {
			await setTheme({ data: next });
			await router.invalidate();
		} finally {
			setPending(false);
		}
	}

	return (
		<DropdownMenuItem
			disabled={pending}
			onSelect={(event) => {
				// Mantiene el menú abierto para poder seguir ciclando el tema.
				event.preventDefault();
				cycle();
			}}
		>
			<Icon />
			Tema: {label}
		</DropdownMenuItem>
	);
}
