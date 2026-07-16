import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { setThemeFn } from "@/modules/common/actions/theme.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import type { Theme } from "@/modules/common/shared/types.ts";

const rootRoute = getRouteApi("__root__");

// Orden del ciclo al pulsar el botón.
const THEME_ORDER: Theme[] = ["dark", "light", "system"];

const THEME_META: Record<Theme, { label: string; icon: typeof Sun }> = {
	dark: { label: "Oscuro", icon: Moon },
	light: { label: "Claro", icon: Sun },
	system: { label: "Sistema", icon: Monitor },
};

export function ThemeToggle() {
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
		<Button
			type="button"
			variant="outline"
			size={"icon"}
			onClick={cycle}
			disabled={pending}
			aria-label={`Tema: ${label}. Cambiar tema`}
			title={`Tema: ${label}`}
		>
			<LoadingSwap isLoading={pending}>
				<span className="flex items-center gap-2">
					<Icon className="size-4" />
				</span>
			</LoadingSwap>
		</Button>
	);
}
