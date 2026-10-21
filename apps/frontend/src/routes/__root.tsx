import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { getThemeFn } from "@/modules/common/actions/theme.ts";
import TanStackQueryDevtools from "@/modules/common/components/integrations/tanstack-query/devtools";
import { AppError } from "@/modules/common/components/partials/app-error.tsx";
import { NotFound } from "@/modules/common/components/partials/not-found.tsx";
import { Toaster } from "@/modules/common/components/ui/sonner.tsx";
import { TooltipProvider } from "@/modules/common/components/ui/tooltip.tsx";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import spaceGroteskLatin from "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url";
// Import por efecto (no `?url`): con `?url` el build de SSR calculaba su propio
// hash de la CSS (distinto del publicado por el build de cliente) y el HTML
// apuntaba a un archivo inexistente (404), dejando la primera carga sin estilos.
import "../styles.css";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	loader: () => getThemeFn(),
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Elineas Auth Identity Server",
			},
			{
				name: "robots",
				content: "noindex, nofollow",
			},
		],
		links: [
			// Las fuentes solo se descubren al parsear el CSS; sin preload el texto
			// se pinta primero con la fuente del sistema y salta al cargar la web
			// font (parece que el CSS tarda en aplicarse). Se precargan solo los
			// subsets latin, que cubren el español.
			{
				rel: "preload",
				href: interLatin,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{
				rel: "preload",
				href: spaceGroteskLatin,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
		],
	}),
	errorComponent: AppError,
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const theme = Route.useLoaderData();
	useEffect(() => {
		if (theme !== "system") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () =>
			document.documentElement.classList.toggle("dark", media.matches);
		apply();
		media.addEventListener("change", apply);
		return () => media.removeEventListener("change", apply);
	}, [theme]);

	return (
		<html
			lang="en"
			className={theme === "light" ? undefined : "dark"}
			suppressHydrationWarning
		>
			<head>
				{theme === "system" && (
					<script
						// biome-ignore lint/security/noDangerouslySetInnerHtml: script estático sin datos de usuario
						dangerouslySetInnerHTML={{
							__html:
								'document.documentElement.classList.toggle("dark",matchMedia("(prefers-color-scheme: dark)").matches)',
						}}
					/>
				)}
				<HeadContent />
			</head>
			<body>
				<TooltipProvider>{children}</TooltipProvider>
				<Toaster richColors />
				{process.env.NODE_ENV === "development" && (
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
				)}
				<Scripts />
			</body>
		</html>
	);
}
