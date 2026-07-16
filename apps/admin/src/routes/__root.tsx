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
import { Toaster } from "@/modules/common/components/ui/sonner.tsx";
import { TooltipProvider } from "@/modules/common/components/ui/tooltip.tsx";
import appCss from "../styles.css?url";

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
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
		],
	}),
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
