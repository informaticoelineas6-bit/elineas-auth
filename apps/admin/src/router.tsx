import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "@/modules/common/components/integrations/tanstack-query/root-provider";
import { AppError } from "@/modules/common/components/partials/app-error.tsx";
import { NotFound } from "@/modules/common/components/partials/not-found.tsx";
import { onSessionExpired } from "@/modules/common/lib/session-expiry.ts";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultViewTransition: true,
		defaultErrorComponent: AppError,
		defaultNotFoundComponent: NotFound,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	// 401 global: cuando una query/mutación detecta la sesión muerta, se redirige
	// al login conservando la ruta actual para volver tras autenticarse. Solo en
	// cliente y si no se está ya en el login.
	if (typeof window !== "undefined") {
		onSessionExpired(() => {
			const { pathname, href } = router.state.location;
			if (pathname === "/") return;
			router.navigate({ to: "/", search: { redirect: href }, replace: true });
		});
	}

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
