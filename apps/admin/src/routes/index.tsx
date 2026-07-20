import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	getSessionFn,
	getTurnstileSiteKeyFn,
	signInFn,
} from "@/modules/auth/actions/auth.ts";
import { LoginForm } from "@/modules/auth/components/login-form.tsx";
import { useSignInForm } from "@/modules/auth/lib/form.ts";
import { useTurnstile } from "@/modules/auth/lib/use-turnstile.ts";
import SideRays from "@/modules/common/components/ui/side-rays.tsx";
import { reportError } from "@/modules/common/lib/errors.ts";
import { useCountdown } from "@/modules/common/lib/use-countdown.ts";

// Solo se admiten rutas internas como destino de vuelta ("/algo"), nunca URLs
// absolutas ("//host", "https://…"): evita un open redirect tras el login.
function safeRedirect(target: string | undefined): string {
	if (target?.startsWith("/") && !target.startsWith("//")) {
		return target;
	}
	return "/dashboard";
}

export const Route = createFileRoute("/")({
	// `redirect` (ruta de origen) lo añade el guard de _authed / el 401 global
	// para volver aquí tras autenticarse.
	validateSearch: z.object({ redirect: z.string().optional() }),
	beforeLoad: async ({ search }) => {
		const session = await getSessionFn();
		if (session) throw redirect({ to: safeRedirect(search.redirect) });
	},
	// Site key de Turnstile (pública): se resuelve en el servidor a partir de
	// TURNSTILE_SITE_KEY y viaja al cliente como loader data, igual que el tema
	// en el root. `null` si no está configurado (login sin captcha).
	loader: () => getTurnstileSiteKeyFn(),
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const turnstileSiteKey = Route.useLoaderData();
	const login = useServerFn(signInFn);
	const rateLimit = useCountdown();
	const turnstile = useTurnstile(turnstileSiteKey);

	const form = useSignInForm(async (value) => {
		try {
			const turnstileToken = await turnstile.getToken();
			const result = await login({
				data: {
					email: value.email,
					password: value.password,
					rememberMe: false,
					turnstileToken,
				},
			});
			if (result.error) {
				// 429: cuenta atrás con el Retry-After real, sin reintentar en bucle.
				if (result.status === 429) {
					rateLimit.start(result.retryAfter ?? 60);
				}
				reportError(result.error);
				return;
			}
			navigate({ to: safeRedirect(search.redirect) });
		} catch (error) {
			reportError(error, "No se pudo iniciar sesión. Intenta nuevamente.");
		}
	});

	return (
		<div className="relative w-full min-h-screen overflow-hidden">
			{/* Los dos abanicos (top-left y top-right) se dibujan en UN solo contexto
			    WebGL vía `sources`, en vez de dos <SideRays> superpuestos con dos
			    contextos GL y dos bucles rAF. */}
			<div className="absolute inset-0">
				<SideRays
					speed={2.5}
					rayColor1="#1b08ea"
					rayColor2="#578bc5"
					intensity={2.5}
					spread={2}
					sources={[
						{ origin: "top-left", tilt: 14 },
						{ origin: "top-right", tilt: -14 },
					]}
					saturation={1.15}
					blend={0.75}
					falloff={1.6}
					opacity={0.75}
				/>
			</div>
			<div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center sm:p-8">
				<h1 className="font-semibold shimmer text-muted-foreground text-5xl text-center">
					Elineas Identity Server
				</h1>
				<LoginForm form={form} rateLimit={rateLimit} turnstile={turnstile} />
			</div>
		</div>
	);
}
